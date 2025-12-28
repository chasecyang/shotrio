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
import { episode, shot, conversation } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";

// 导入所有需要的 actions
import { batchGenerateShotVideos } from "../video/generate";
import { deleteShot, updateShot, batchCreateShots } from "../project/shot";
import { updateAsset, deleteAsset } from "../asset/crud";
import { queryAssets } from "../asset/queries";
import { refreshEpisodeShots } from "../project/refresh";
import { createJob } from "../job";
import type { AssetImageGenerationInput } from "@/types/job";
import { getSystemArtStyles } from "../art-style/queries";
import { updateProject } from "../project/base";
import { analyzeAssetsByType } from "../asset/stats";
import { updateEpisode } from "../project/episode";
import type { NewEpisode } from "@/types/project";

/**
 * 映射 shotSize 值到数据库枚举
 */
function mapShotSize(value: string): string {
  const mapping: Record<string, string> = {
    'WIDE': 'long_shot',
    'FULL': 'full_shot',
    'MEDIUM': 'medium_shot',
    'CLOSE_UP': 'close_up',
    'EXTREME_CLOSE_UP': 'extreme_close_up',
    'EXTREME_LONG_SHOT': 'extreme_long_shot',
    // 支持直接使用数据库值
    'extreme_long_shot': 'extreme_long_shot',
    'long_shot': 'long_shot',
    'full_shot': 'full_shot',
    'medium_shot': 'medium_shot',
    'close_up': 'close_up',
    'extreme_close_up': 'extreme_close_up',
  };
  
  const mapped = mapping[value] || mapping[value.toUpperCase()];
  if (!mapped) {
    throw new Error(`无效的景别值: ${value}. 支持的值: ${Object.keys(mapping).filter(k => k === k.toUpperCase()).join(', ')}`);
  }
  return mapped;
}

/**
 * 映射 cameraMovement 值到数据库枚举
 */
function mapCameraMovement(value: string): string {
  const mapping: Record<string, string> = {
    'STATIC': 'static',
    'PUSH_IN': 'push_in',
    'PULL_OUT': 'pull_out',
    'PAN_LEFT': 'pan_left',
    'PAN_RIGHT': 'pan_right',
    'TILT_UP': 'tilt_up',
    'TILT_DOWN': 'tilt_down',
    'TRACKING': 'tracking',
    'CRANE_UP': 'crane_up',
    'CRANE_DOWN': 'crane_down',
    'ORBIT': 'orbit',
    'ZOOM_IN': 'zoom_in',
    'ZOOM_OUT': 'zoom_out',
    'HANDHELD': 'handheld',
    // 支持直接使用数据库值
    'static': 'static',
    'push_in': 'push_in',
    'pull_out': 'pull_out',
    'pan_left': 'pan_left',
    'pan_right': 'pan_right',
    'tilt_up': 'tilt_up',
    'tilt_down': 'tilt_down',
    'tracking': 'tracking',
    'crane_up': 'crane_up',
    'crane_down': 'crane_down',
    'orbit': 'orbit',
    'zoom_in': 'zoom_in',
    'zoom_out': 'zoom_out',
    'handheld': 'handheld',
  };
  
  const mapped = mapping[value] || mapping[value.toUpperCase()];
  if (!mapped) {
    throw new Error(`无效的运镜方式值: ${value}. 支持的值: ${Object.keys(mapping).filter(k => k === k.toUpperCase()).join(', ')}`);
  }
  return mapped;
}

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
        const includeArtStyles = parameters.includeArtStyles !== false; // 默认true

        const contextData: Record<string, unknown> = {};

        // 如果提供了episodeId，获取剧本和分镜
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

            // 获取分镜列表
            const shotsResult = await refreshEpisodeShots(episodeId);
            if (shotsResult.success) {
              contextData.shots = shotsResult.shots;
            }
          }
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

      case "query_shots": {
        const episodeId = parameters.episodeId as string;
        const shotIds = parameters.shotIds as string[] | undefined;

        const shotsResult = await refreshEpisodeShots(episodeId);
        
        if (!shotsResult.success) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: shotsResult.error,
          };
          break;
        }

        // 如果指定了shotIds，只返回这些分镜
        let shots = shotsResult.shots || [];
        if (shotIds && shotIds.length > 0) {
          shots = shots.filter(s => shotIds.includes(s.id));
        }

        result = {
          functionCallId: functionCall.id,
          success: true,
          data: { shots, total: shots.length },
        };
        break;
      }

      // ============================================
      // 创作类
      // ============================================
      case "create_shots": {
        const episodeId = parameters.episodeId as string;
        const shots = parameters.shots as Array<{
          shotSize: string;
          description: string;
          order?: number;
          cameraMovement?: string;
          duration?: number;
          visualPrompt?: string;
        }>;

        try {
          // 验证和转换数据，使用映射函数
          const validatedShots = shots.map((shotData) => ({
            shotSize: mapShotSize(shotData.shotSize) as "extreme_long_shot" | "long_shot" | "full_shot" | "medium_shot" | "close_up" | "extreme_close_up",
            description: shotData.description,
            order: shotData.order,
            cameraMovement: shotData.cameraMovement 
              ? mapCameraMovement(shotData.cameraMovement) as "static" | "push_in" | "pull_out" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "tracking" | "crane_up" | "crane_down"
              : undefined,
            duration: shotData.duration,
            visualPrompt: shotData.visualPrompt,
          }));

          const batchResult = await batchCreateShots({
            episodeId,
            shots: validatedShots,
          });

          if (batchResult.success && 'data' in batchResult) {
            result = {
              functionCallId: functionCall.id,
              success: true,
              data: batchResult.data,
            };
          } else {
            result = {
              functionCallId: functionCall.id,
              success: false,
              error: 'error' in batchResult ? batchResult.error : "创建失败",
            };
          }
        } catch (error) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: error instanceof Error ? error.message : "参数验证失败",
          };
        }
        break;
      }

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

      case "generate_videos": {
        const shotIds = parameters.shotIds as string[];
        const videoResult = await batchGenerateShotVideos(shotIds);

        result = {
          functionCallId: functionCall.id,
          success: videoResult.success,
          jobId: videoResult.jobId,
          error: videoResult.error,
        };
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

      case "update_shots": {
        const updates = parameters.updates as Array<{
          shotId: string;
          duration?: number;
          shotSize?: string;
          cameraMovement?: string;
          description?: string;
          visualPrompt?: string;
          imageAssetId?: string;
        }>;

        const updateResults: Array<{ shotId: string; success: boolean; error?: string }> = [];

        for (const update of updates) {
          const { shotId, ...fields } = update;
          
          try {
            // 转换枚举值
            const mappedFields: Record<string, unknown> = { ...fields };
            if (fields.shotSize) {
              mappedFields.shotSize = mapShotSize(fields.shotSize);
            }
            if (fields.cameraMovement) {
              mappedFields.cameraMovement = mapCameraMovement(fields.cameraMovement);
            }
            
            const updateResult = await updateShot(shotId, mappedFields);
            updateResults.push({
              shotId,
              success: updateResult.success,
              error: updateResult.error,
            });
          } catch (error) {
            updateResults.push({
              shotId,
              success: false,
              error: error instanceof Error ? error.message : "参数验证失败",
            });
          }
        }

        const successCount = updateResults.filter(r => r.success).length;
        const errors = updateResults.filter(r => !r.success).map(r => `${r.shotId}: ${r.error}`);

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
      case "delete_shots": {
        const shotIds = parameters.shotIds as string[];

        for (const shotId of shotIds) {
          await deleteShot(shotId);
        }

        result = {
          functionCallId: functionCall.id,
          success: true,
          data: { deleted: shotIds.length },
        };
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
