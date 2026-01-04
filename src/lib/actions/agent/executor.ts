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
import { conversation } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";

// 导入所有需要的 actions
import { updateAsset, deleteAsset } from "../asset/crud";
import { queryAssets } from "../asset/queries";
import { replaceAssetTags } from "../asset/tags";
import { createJob } from "../job";
import { getSystemArtStyles } from "../art-style/queries";
import { updateProject } from "../project/base";
import { analyzeAssetsByType } from "../asset/stats";
import { 
  getVideoAssets,
  createVideoAsset,
} from "../asset/crud";
import { 
  createTextAsset,
  getTextAssetContent,
} from "../asset/text-asset";

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
        const includeAssets = parameters.includeAssets !== false; // 默认true
        const includeVideos = parameters.includeVideos !== false; // 默认true
        const includeArtStyles = parameters.includeArtStyles !== false; // 默认true

        const contextData: Record<string, unknown> = {};

        // 包含视频列表
        if (includeVideos) {
          const videosResult = await getVideoAssets(projectId, { orderBy: "created" });
          const videos = videosResult.videos || [];
          const completedVideos = videos.filter(v => v.runtimeStatus === "completed");
          const processingVideos = videos.filter(v => v.runtimeStatus === "processing" || v.runtimeStatus === "pending");
          
          contextData.videos = {
            total: videos.length,
            completed: completedVideos.length,
            processing: processingVideos.length,
            list: videos.map(v => ({
              id: v.id,
              prompt: v.prompt,
              name: v.name,
              status: v.runtimeStatus,
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
        const assetType = parameters.assetType as "image" | "video" | undefined;
        const queryResult = await queryAssets({
          projectId,
          assetType,
          tagFilters: tagArray,
          limit: (parameters.limit as number) || 20,
        });

        // 统计状态
        const completedCount = queryResult.assets.filter(a => a.runtimeStatus === "completed").length;
        const processingCount = queryResult.assets.filter(a => a.runtimeStatus === "processing").length;
        const failedCount = queryResult.assets.filter(a => a.runtimeStatus === "failed").length;

        const typeLabel = assetType === "image" ? "图片资产" : assetType === "video" ? "视频资产" : "资产";
        
        // 格式化资产信息，提供更详细的数据给AI
        const formattedAssets = queryResult.assets.map(a => ({
          id: a.id,
          name: a.name,
          type: a.assetType,
          status: a.runtimeStatus,
          imageUrl: a.imageUrl,
          videoUrl: a.videoUrl,
          duration: a.duration,
          prompt: a.prompt,
          tags: a.tags.map(t => t.tagValue),
          order: a.order,
          createdAt: a.createdAt,
          // 如果有source信息，也包含进来
          sourceAssetIds: a.sourceAssetIds,
        }));
        
        result = {
          functionCallId: functionCall.id,
          success: true,
          data: {
            assets: formattedAssets,
            total: queryResult.total,
            completed: completedCount,
            processing: processingCount,
            failed: failedCount,
            message: queryResult.assets.length === 0 
              ? `${typeLabel}库为空，没有找到任何${typeLabel}` 
              : `找到 ${queryResult.total} 个${typeLabel}（${completedCount} 个已完成，${processingCount} 个处理中${failedCount > 0 ? `，${failedCount} 个失败` : ''}）`,
          },
        };
        break;
      }

      // ============================================
      // 创作类
      // ============================================

      case "generate_image_asset": {
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
            const jobResult = await createJob({
              userId: session.user.id,
              projectId,
              type: "asset_image_generation",
              assetId: assetId, // 外键关联
              inputData: {}, // 所有生成信息已存储在 asset 表中
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

      case "generate_video_asset": {
        const title = parameters.title as string | undefined;
        const referenceAssetIds = parameters.referenceAssetIds as string[] | undefined;
        const tags = parameters.tags as string[] | undefined;
        const order = parameters.order as number | undefined;

        try {
          // 使用 validation.ts 中的统一校验
          const { validateFunctionParameters } = await import("@/lib/actions/agent/validation");
          const validationResult = await validateFunctionParameters(
            "generate_video_asset",
            JSON.stringify(parameters)
          );
          
          if (!validationResult.valid) {
            result = {
              functionCallId: functionCall.id,
              success: false,
              error: `参数校验失败: ${validationResult.errors.join("; ")}`,
            };
            break;
          }
          
          // 从校验结果中获取标准化配置
          const normalizedConfig = validationResult.normalizedConfig!;
          
          // 直接使用标准化的配置构建 VideoGenerationConfig
          const generationConfig = {
            prompt: normalizedConfig.prompt,
            start_image_url: normalizedConfig.start_image_url,
            end_image_url: normalizedConfig.end_image_url,
            duration: normalizedConfig.duration,
            aspect_ratio: normalizedConfig.aspect_ratio,
            negative_prompt: normalizedConfig.negative_prompt,
          };
          
          // 创建视频生成任务
          const generateResult = await createVideoAsset({
            projectId,
            name: title || "未命名视频",
            prompt: normalizedConfig.prompt,
            referenceAssetIds,
            generationConfig,
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
      case "update_asset": {
        const updates = parameters.updates as Array<{
          assetId: string;
          name?: string;
          tags?: string[];
        }>;

        const updateResults: Array<{ assetId: string; success: boolean; error?: string }> = [];

        for (const update of updates) {
          const { assetId, name, tags } = update;
          
          try {
            // 更新 name（如果提供）
            if (name !== undefined) {
              const nameUpdateResult = await updateAsset(assetId, { name });
              if (!nameUpdateResult.success) {
                updateResults.push({
                  assetId,
                  success: false,
                  error: nameUpdateResult.error,
                });
                continue;
              }
            }

            // 更新 tags（如果提供）
            if (tags !== undefined) {
              const tagsUpdateResult = await replaceAssetTags(assetId, tags);
              if (!tagsUpdateResult.success) {
                updateResults.push({
                  assetId,
                  success: false,
                  error: tagsUpdateResult.error,
                });
                continue;
              }
            }

            updateResults.push({
              assetId,
              success: true,
            });
          } catch (error) {
            updateResults.push({
              assetId,
              success: false,
              error: error instanceof Error ? error.message : "更新失败",
            });
          }
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
        // 验证参数
        if (!parameters.styleId) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: "缺少必需参数: styleId",
          };
          break;
        }

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
      // 文本资产类
      // ============================================
      case "create_text_asset": {
        const name = parameters.name as string;
        const content = parameters.content as string;
        const format = (parameters.format as "markdown" | "plain") || "markdown";
        const tags = (parameters.tags as string[]) || [];

        const createResult = await createTextAsset({
          projectId,
          name,
          content,
          format,
          tags,
        });

        if (createResult.success) {
          result = {
            functionCallId: functionCall.id,
            success: true,
            data: {
              assetId: createResult.asset?.id,
              name: createResult.asset?.name,
              message: `已创建文本资产"${name}"`,
            },
          };
        } else {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: createResult.error || "创建文本资产失败",
          };
        }
        break;
      }

      case "query_text_assets": {
        const tags = parameters.tags as string[] | undefined;
        const limit = (parameters.limit as number) || 10;

        // 查询文本类型的资产
        const queryResult = await queryAssets({
          projectId,
          assetType: "text",
          tagFilters: tags,
          limit,
        });

        // 获取每个文本资产的完整内容
        const textAssets = await Promise.all(
          queryResult.assets.map(async (asset) => {
            const contentResult = await getTextAssetContent(asset.id);
            return {
              id: asset.id,
              name: asset.name,
              content: contentResult.content || "",
              format: contentResult.format || "markdown",
              tags: asset.tags.map(t => t.tagValue),
              createdAt: asset.createdAt,
            };
          })
        );

        result = {
          functionCallId: functionCall.id,
          success: true,
          data: {
            assets: textAssets,
            total: queryResult.total,
            message: textAssets.length === 0 
              ? "没有找到文本资产" 
              : `找到 ${textAssets.length} 个文本资产`,
          },
        };
        break;
      }

      // ============================================
      // 删除类
      // ============================================
      case "delete_asset": {
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
