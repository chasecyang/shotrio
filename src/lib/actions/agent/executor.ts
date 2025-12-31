"use server";

/**
 * Agent Function 执行器（精简版）
 * 
 * 将 Function Call 路由到对应的 Server Action
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { FunctionCall, FunctionExecutionResult } from "@/types/agent";
import db from "@/lib/db";
import { episode, conversation } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";

// 导入所有需要的 actions
import { updateAsset, deleteAsset } from "../asset/crud";
import { queryAssets } from "../asset/queries";
import { createJob } from "../job";
import type { AssetImageGenerationInput } from "@/types/job";
import { getSystemArtStyles } from "../art-style/queries";
import { updateProject } from "../project/base";
import { analyzeAssetsByType } from "../asset/stats";
import { updateEpisode } from "../project/episode";
import type { NewEpisode } from "@/types/project";
import { 
  getVideoAssets,
  createVideoAsset,
  updateVideoAsset,
  deleteVideoAssets,
} from "../asset/crud";

/**
 * 执行单个 function call
 */
export async function executeFunction(
  functionCall: FunctionCall,
  conversationId: string
): Promise<FunctionExecutionResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: "未登录",
    };
  }

  // 从 conversation 表获取 projectId
  const conv = await db.query.conversation.findFirst({
    where: eq(conversation.id, conversationId),
  });

  if (!conv || !conv.projectId) {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: "对话不存在或未关联项目",
    };
  }

  const projectId = conv.projectId;
  const { name, parameters } = functionCall;

  try {
    let result: FunctionExecutionResult;

    switch (name) {
      // ============================================
      // 查询类
      // ============================================
      case "query_context": {
        const episodeId = parameters.episodeId as string | undefined;
        const includeAssets = parameters.includeAssets !== false; // 默认true
        const includeVideos = parameters.includeVideos !== false; // 默认true
        const includeArtStyles = parameters.includeArtStyles !== false; // 默认true

        const contextData: Record<string, unknown> = {};

        // 如果提供了episodeId，获取剧本
        if (episodeId) {
          const episodeData = await db.query.episode.findFirst({
            where: eq(episode.id, episodeId),
          });
          
          if (episodeData) {
            contextData.episode = {
              id: episodeData.id,
              title: episodeData.title,
              scriptContent: episodeData.scriptContent,
              summary: episodeData.summary,
            };
          }
        }

        // 包含视频列表
        if (includeVideos) {
          const videosResult = await getVideoAssets(projectId, { orderBy: "created" });
          const videos = videosResult.videos || [];
          const completedVideos = videos.filter(v => v.status === "completed");
          const processingVideos = videos.filter(v => v.status === "processing" || v.status === "pending");
          
          contextData.videos = {
            total: videos.length,
            completed: completedVideos.length,
            processing: processingVideos.length,
            list: videos.map(v => ({
              id: v.id,
              prompt: v.prompt,
              name: v.name,
              status: v.status,
              duration: v.duration,
              tags: v.tags.map(t => t.tagValue),
              order: v.order,
            })),
          };
        }

        // 包含素材统计
        if (includeAssets) {
          const assetsResult = await queryAssets({
            projectId,
            limit: 1000,
          });

          const assetStats = assetsResult.assets 
            ? await analyzeAssetsByType(assetsResult.assets)
            : { byType: {}, withoutImage: 0 };

          // 计算completed和generating数量
          const completedCount = assetsResult.assets.filter(a => a.imageUrl).length;
          const generatingCount = assetsResult.assets.filter(a => !a.imageUrl).length;

          contextData.assets = {
            total: assetsResult.total || 0,
            byType: assetStats.byType,
            completed: completedCount,
            generating: generatingCount,
          };
        }

        // 包含美术风格
        if (includeArtStyles) {
          const styles = await getSystemArtStyles();
          contextData.artStyles = styles;
        }

        result = {
          functionCallId: functionCall.id,
          success: true,
          data: contextData,
        };
        break;
      }

      case "query_assets": {
        const tagArray = parameters.tags as string[] | undefined;
        const queryResult = await queryAssets({
          projectId,
          tagFilters: tagArray,
          limit: (parameters.limit as number) || 20,
        });

        // 统计状态
        const completedCount = queryResult.assets.filter(a => a.status === "completed").length;
        const generatingCount = queryResult.assets.filter(a => a.status === "generating").length;

        result = {
          functionCallId: functionCall.id,
          success: true,
          data: {
            assets: queryResult.assets,
            total: queryResult.total,
            completed: completedCount,
            generating: generatingCount,
            message: queryResult.assets.length === 0 
              ? "素材库为空，没有找到任何素材" 
              : `找到 ${queryResult.total} 个素材（${completedCount} 个已完成，${generatingCount} 个生成中）`,
          },
        };
        break;
      }

      case "query_videos": {
        const videoIds = parameters.videoIds as string[] | undefined;
        const tags = parameters.tags as string[] | undefined;

        const videosResult = await getVideoAssets(projectId, {
          tags,
          orderBy: "created",
        });
        
        if (!videosResult.success) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: videosResult.error || "查询视频失败",
          };
          break;
        }

        let videos = videosResult.videos || [];
        
        // 按 videoIds 筛选
        if (videoIds && videoIds.length > 0) {
          videos = videos.filter(v => videoIds.includes(v.id));
        }

        result = {
          functionCallId: functionCall.id,
          success: true,
          data: { 
            videos: videos.map(v => ({
              id: v.id,
              prompt: v.prompt,
              name: v.name,
              status: v.status,
              videoUrl: v.videoUrl,
              thumbnailUrl: v.thumbnailUrl,
              duration: v.duration,
              tags: v.tags.map(t => t.tagValue),
              order: v.order,
              sourceAssetIds: v.sourceAssetIds,
              createdAt: v.createdAt,
            })),
            total: videos.length,
          },
        };
        break;
      }

      // ============================================
      // 创作类
      // ============================================

      case "generate_assets": {
        const assets = parameters.assets as Array<{
          name?: string;
          prompt: string;
          tags?: string[];
          sourceAssetIds?: string[];
        }>;

        const jobIds: string[] = [];
        const assetIds: string[] = [];
        const errors: string[] = [];

        // 为每个素材创建记录和独立的生成任务
        const { createAssetInternal } = await import("../asset/crud");
        
        for (const assetData of assets) {
          try {
            // 生成素材名称（如果未提供）
            const assetName = assetData.name || `AI生成-${Date.now()}`;

            // 创建素材记录（包含所有生成信息，但无图片）
            const createResult = await createAssetInternal({
              projectId,
              userId: session.user.id,
              name: assetName,
              prompt: assetData.prompt,
              tags: assetData.tags,
              modelUsed: "nano-banana",
              sourceAssetIds: assetData.sourceAssetIds,
              derivationType: assetData.sourceAssetIds ? "img2img" : "generate",
              meta: {
                generationParams: {
                  aspectRatio: "16:9" as "16:9" | "1:1" | "9:16",
                  numImages: 1,
                },
              },
            });

            if (!createResult.success || !createResult.asset) {
              errors.push(`创建素材 ${assetName} 失败: ${createResult.error}`);
              continue;
            }

            const assetId = createResult.asset.id;
            assetIds.push(assetId);

            // 创建图片生成任务
            const input: AssetImageGenerationInput = {
              assetId,
            };

            const jobResult = await createJob({
              userId: session.user.id,
              projectId,
              type: "asset_image_generation",
              inputData: input,
            });

            if (jobResult.success && jobResult.jobId) {
              jobIds.push(jobResult.jobId);
            } else {
              errors.push(`创建 "${assetData.name || 'unnamed'}" 任务失败: ${jobResult.error || "未知错误"}`);
            }
          } catch (error) {
            console.error(`处理素材 ${assetData.name || 'unnamed'} 失败:`, error);
            errors.push(
              `处理素材 "${assetData.name || 'unnamed'}" 失败: ${error instanceof Error ? error.message : "未知错误"}`
            );
          }
        }

        result = {
          functionCallId: functionCall.id,
          success: jobIds.length > 0,
          data: {
            jobIds,
            assetIds,
            createdCount: jobIds.length,
            totalCount: assets.length,
            errors: errors.length > 0 ? errors : undefined,
          },
          error: errors.length > 0 && jobIds.length === 0 
            ? `所有任务创建失败: ${errors.join("; ")}` 
            : undefined,
        };
        break;
      }

      case "generate_video": {
        const prompt = parameters.prompt as string;
        const title = parameters.title as string | undefined;
        const referenceAssetIds = parameters.referenceAssetIds as string[] | undefined;
        const tags = parameters.tags as string[] | undefined;
        const order = parameters.order as number | undefined;
        const klingO1Config = parameters.klingO1Config as {
          prompt: string;
          elements?: Array<{
            frontal_image_url: string;
            reference_image_urls?: string[];
          }>;
          image_urls?: string[];
          duration?: "5" | "10";
          aspect_ratio?: "16:9" | "9:16" | "1:1";
        };

        if (!prompt || !klingO1Config || !klingO1Config.prompt) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: "缺少必填参数：prompt 和 klingO1Config.prompt",
          };
          break;
        }

        try {
          // 参数校验
          const { validateKlingO1Config } = await import("@/lib/utils/video-validation");
          const validationResult = validateKlingO1Config(klingO1Config);
          
          if (!validationResult.valid) {
            result = {
              functionCallId: functionCall.id,
              success: false,
              error: `参数校验失败: ${validationResult.errors.join("; ")}`,
            };
            break;
          }
          
          const normalizedConfig = validationResult.normalizedConfig!;
          
          // 创建视频生成任务
          const generateResult = await createVideoAsset({
            projectId,
            name: title || prompt,
            prompt,
            referenceAssetIds,
            generationConfig: normalizedConfig,
            order,
            tags,
          });

          if (generateResult.success) {
            result = {
              functionCallId: functionCall.id,
              success: true,
              data: {
                assetId: generateResult.data?.asset.id,
                jobId: generateResult.data?.jobId,
                message: "视频生成任务已创建",
              },
            };
          } else {
            result = {
              functionCallId: functionCall.id,
              success: false,
              error: generateResult.error || "创建视频生成任务失败",
            };
          }
        } catch (error) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: error instanceof Error ? error.message : "生成视频失败",
          };
        }
        break;
      }

      // ============================================
      // 修改类
      // ============================================
      case "update_episode": {
        const episodeId = parameters.episodeId as string;
        const updates: Partial<NewEpisode> = {};
        
        if (parameters.title !== undefined) updates.title = parameters.title as string;
        if (parameters.summary !== undefined) updates.summary = parameters.summary as string || null;
        if (parameters.scriptContent !== undefined) updates.scriptContent = parameters.scriptContent as string || null;
        
        const updateResult = await updateEpisode(episodeId, updates);
        
        if (updateResult.success) {
          result = {
            functionCallId: functionCall.id,
            success: true,
            data: {
              message: "剧集信息已更新",
              updatedFields: Object.keys(updates),
              episode: updateResult.data,
            },
          };
        } else {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: updateResult.error || "更新失败",
          };
        }
        break;
      }

      case "update_videos": {
        const updates = parameters.updates as Array<{
          videoId: string;
          prompt?: string;
          name?: string;
          order?: number;
        }>;

        const results = [];
        
        for (const update of updates) {
          const { videoId, ...updateData } = update;
          const updateResult = await updateVideoAsset(videoId, updateData);
          
          if (updateResult.success) {
            results.push({
              videoId,
              success: true,
            });
          } else {
            results.push({
              videoId,
              success: false,
              error: updateResult.error,
            });
          }
        }

        const successCount = results.filter(r => r.success).length;
        const failedCount = results.length - successCount;

        result = {
          functionCallId: functionCall.id,
          success: failedCount === 0,
          data: {
            results,
            successCount,
            failedCount,
            message: `已更新 ${successCount} 个视频${failedCount > 0 ? `，${failedCount} 个失败` : ""}`,
          },
        };
        break;
      }

      case "update_assets": {
        const updates = parameters.updates as Array<{
          assetId: string;
          name?: string;
          tags?: string[];
        }>;

        const updateResults: Array<{ assetId: string; success: boolean; error?: string }> = [];

        for (const update of updates) {
          const { assetId, ...fields } = update;
          const updateResult = await updateAsset(assetId, fields);
          updateResults.push({
            assetId,
            success: updateResult.success,
            error: updateResult.error,
          });
        }

        const successCount = updateResults.filter(r => r.success).length;
        const errors = updateResults.filter(r => !r.success).map(r => `${r.assetId}: ${r.error}`);

        result = {
          functionCallId: functionCall.id,
          success: successCount > 0,
          data: {
            updated: successCount,
            total: updates.length,
            errors: errors.length > 0 ? errors : undefined,
          },
          error: successCount === 0 ? `所有更新失败: ${errors.join("; ")}` : undefined,
        };
        break;
      }

      case "set_art_style": {
        const updateResult = await updateProject(
          projectId,
          { styleId: parameters.styleId as string }
        );

        result = {
          functionCallId: functionCall.id,
          success: updateResult.success,
          data: updateResult.data,
          error: updateResult.error,
        };
        break;
      }

      // ============================================
      // 删除类
      // ============================================
      case "delete_videos": {
        const videoIds = parameters.videoIds as string[];

        const deleteResult = await deleteVideoAssets(videoIds);

        if (deleteResult.success) {
          result = {
            functionCallId: functionCall.id,
            success: true,
            data: {
              deletedCount: deleteResult.deletedCount,
              message: `已删除 ${deleteResult.deletedCount} 个视频`,
            },
          };
        } else {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: deleteResult.error || "删除视频失败",
          };
        }
        break;
      }

      case "delete_assets": {
        const assetIds = parameters.assetIds as string[];
        const deleteResults: Array<{ assetId: string; success: boolean; error?: string }> = [];

        for (const assetId of assetIds) {
          const deleteResult = await deleteAsset(assetId);
          deleteResults.push({
            assetId,
            success: deleteResult.success,
            error: deleteResult.error,
          });
        }

        const successCount = deleteResults.filter(r => r.success).length;
        const errors = deleteResults.filter(r => !r.success).map(r => `${r.assetId}: ${r.error}`);

        result = {
          functionCallId: functionCall.id,
          success: successCount > 0,
          data: {
            deleted: successCount,
            total: assetIds.length,
            errors: errors.length > 0 ? errors : undefined,
          },
          error: successCount === 0 ? `所有删除失败: ${errors.join("; ")}` : undefined,
        };
        break;
      }

      default:
        result = {
          functionCallId: functionCall.id,
          success: false,
          error: `未知的 function: ${name}`,
        };
    }

    return result;
  } catch (error) {
    console.error(`执行 function ${name} 失败:`, error);
    return {
      functionCallId: functionCall.id,
      success: false,
      error: error instanceof Error ? error.message : "执行失败",
    };
  }
}
