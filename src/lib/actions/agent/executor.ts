"use server";

/**
 * Agent Function 执行器
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
import { createShot, deleteShot, updateShot, reorderShots, batchCreateShots } from "../project/shot";
import { updateAsset, deleteAsset } from "../asset/crud";
import { queryAssets } from "../asset/queries";
import { refreshEpisodeShots } from "../project/refresh";
import { createJob } from "../job";
import type { AssetImageGenerationInput } from "@/types/job";
import { getSystemArtStyles } from "../art-style/queries";
import { updateProject } from "../project/base";
import { analyzeAssetsByType } from "../asset/stats";

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
      case "query_script_content": {
        const episodeData = await db.query.episode.findFirst({
          where: eq(episode.id, parameters.episodeId as string),
        });
        
        if (!episodeData) {
          return {
            functionCallId: functionCall.id,
            success: false,
            error: "剧集不存在",
          };
        }

        result = {
          functionCallId: functionCall.id,
          success: true,
          data: {
            title: episodeData.title,
            scriptContent: episodeData.scriptContent,
            summary: episodeData.summary,
          },
        };
        break;
      }

      case "query_assets": {
        const tagArray = parameters.tags ? (parameters.tags as string).split(",") : undefined;
        const queryResult = await queryAssets({
          projectId,
          tagFilters: tagArray,
          limit: parameters.limit ? parseInt(parameters.limit as string) : 20,
        });

        result = {
          functionCallId: functionCall.id,
          success: true, // 查询成功执行，即使结果为空也算成功
          data: {
            assets: queryResult.assets,
            total: queryResult.total,
            message: queryResult.assets.length === 0 
              ? "素材库为空，没有找到任何素材" 
              : `找到 ${queryResult.total} 个素材`,
          },
        };
        break;
      }

      case "query_shots": {
        const shotsResult = await refreshEpisodeShots(parameters.episodeId as string);
        result = {
          functionCallId: functionCall.id,
          success: shotsResult.success,
          data: shotsResult.shots,
          error: shotsResult.error,
        };
        break;
      }

      case "query_shot_details": {
        const shotData = await db.query.shot.findFirst({
          where: eq(shot.id, parameters.shotId as string),
        });

        if (!shotData) {
          return {
            functionCallId: functionCall.id,
            success: false,
            error: "分镜不存在",
          };
        }

        result = {
          functionCallId: functionCall.id,
          success: true,
          data: shotData,
        };
        break;
      }

      case "analyze_project_stats": {
        const assetsResult = await queryAssets({
          projectId,
          limit: 1000,
        });

        const assetStats = assetsResult.assets 
          ? await analyzeAssetsByType(assetsResult.assets)
          : { byType: {}, withoutImage: 0 };

        result = {
          functionCallId: functionCall.id,
          success: true,
          data: {
            totalAssets: assetsResult.total || 0,
            assetsByType: assetStats.byType,
            assetsWithoutImage: assetStats.withoutImage,
          },
        };
        break;
      }

      case "query_available_art_styles": {
        const styles = await getSystemArtStyles();
        
        result = {
          functionCallId: functionCall.id,
          success: true,
          data: {
            styles,
            message: `找到 ${styles.length} 个系统预设风格`,
          },
        };
        break;
      }

      // ============================================
      // 创建类
      // ============================================
      case "create_shot": {
        // 获取当前剧集的分镜数量以确定 order
        let order = parameters.order ? parseInt(parameters.order as string) : undefined;
        
        if (order === undefined) {
          const existingShots = await db.query.shot.findMany({
            where: eq(shot.episodeId, parameters.episodeId as string),
          });
          order = existingShots.length + 1;
        }

        const createResult = await createShot({
          episodeId: parameters.episodeId as string,
          order,
          shotSize: parameters.shotSize as "extreme_long_shot" | "long_shot" | "full_shot" | "medium_shot" | "close_up" | "extreme_close_up",
          cameraMovement: (parameters.cameraMovement as "static" | "push_in" | "pull_out" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "tracking" | "crane_up" | "crane_down") || "static",
          duration: parameters.duration ? parseInt(parameters.duration as string) : 3000,
          description: parameters.description as string,
          visualPrompt: parameters.visualPrompt as string | undefined,
        });

        result = {
          functionCallId: functionCall.id,
          success: createResult.success,
          data: createResult.data,
          error: createResult.error,
        };
        break;
      }

      case "batch_create_shots": {
        // 解析 shots 参数，支持数组或 JSON 字符串
        let shotsData: Array<{
          shotSize: string;
          description: string;
          order?: number;
          cameraMovement?: string;
          duration?: number;
          visualPrompt?: string;
          audioPrompt?: string;
          imageAssetId?: string;
        }>;
        
        if (Array.isArray(parameters.shots)) {
          shotsData = parameters.shots;
        } else {
          try {
            shotsData = JSON.parse(parameters.shots as string);
          } catch (error) {
            console.error("[executeFunction] 解析 shots 参数失败:", error);
            return {
              functionCallId: functionCall.id,
              success: false,
              error: "shots 参数格式错误",
            };
          }
        }

        // 验证和转换数据
        const validatedShots = shotsData.map((shotData) => ({
          shotSize: shotData.shotSize as "extreme_long_shot" | "long_shot" | "full_shot" | "medium_shot" | "close_up" | "extreme_close_up",
          description: shotData.description,
          order: shotData.order,
          cameraMovement: shotData.cameraMovement as "static" | "push_in" | "pull_out" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "tracking" | "crane_up" | "crane_down" | undefined,
          duration: shotData.duration,
          visualPrompt: shotData.visualPrompt,
          audioPrompt: shotData.audioPrompt,
          imageAssetId: shotData.imageAssetId,
        }));

        const batchResult = await batchCreateShots({
          episodeId: parameters.episodeId as string,
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
        break;
      }

      // ============================================
      // 生成类
      // ============================================
      case "generate_shot_videos": {
        // 解析 shotIds 参数，支持数组或 JSON 字符串
        let shotIds: string[];
        if (Array.isArray(parameters.shotIds)) {
          shotIds = parameters.shotIds;
        } else {
          try {
            shotIds = JSON.parse(parameters.shotIds as string);
          } catch (error) {
            console.error("[executeFunction] 解析 shotIds 参数失败:", error);
            return {
              functionCallId: functionCall.id,
              success: false,
              error: "shotIds 参数格式错误",
            };
          }
        }
        
        const videoResult = await batchGenerateShotVideos(shotIds);

        result = {
          functionCallId: functionCall.id,
          success: videoResult.success,
          jobId: videoResult.jobId,
          error: videoResult.error,
        };
        break;
      }

      case "generate_asset": {
        // 解析标签
        let parsedTags: string[] | undefined;
        if (parameters.tags) {
          const tagsStr = (parameters.tags as string).trim();
          // 支持 JSON 数组格式和逗号分隔格式
          if (tagsStr.startsWith('[')) {
            parsedTags = JSON.parse(tagsStr);
          } else {
            parsedTags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
          }
        }

        // 解析 sourceAssetIds
        let parsedSourceAssetIds: string[] | undefined;
        if (parameters.sourceAssetIds) {
          // 如果已经是数组，直接使用
          if (Array.isArray(parameters.sourceAssetIds)) {
            parsedSourceAssetIds = parameters.sourceAssetIds;
          } else {
            // 如果是字符串，尝试解析 JSON
            try {
              const sourceStr = (parameters.sourceAssetIds as string).trim();
              parsedSourceAssetIds = JSON.parse(sourceStr);
            } catch (error) {
              console.error("[executeFunction] 解析 sourceAssetIds 失败:", error);
              // 如果解析失败，尝试按逗号分隔
              parsedSourceAssetIds = (parameters.sourceAssetIds as string)
                .split(',')
                .map(id => id.trim())
                .filter(Boolean);
            }
          }
        }

        // 生成素材名称（如果未提供）
        const assetName = (parameters.name as string) || `AI生成-${Date.now()}`;

        // 解析 numImages
        const numImages = parameters.numImages ? parseInt(parameters.numImages as string) : 1;

        // 第一步：立即创建素材记录（包含所有生成信息，但无图片）
        const { createAssetInternal } = await import("../asset/crud");
        const createResult = await createAssetInternal({
          projectId,
          userId: session.user.id,
          name: assetName,
          prompt: parameters.prompt as string,
          tags: parsedTags,
          modelUsed: "nano-banana",
          sourceAssetIds: parsedSourceAssetIds,
          derivationType: parsedSourceAssetIds ? "img2img" : "generate",
          meta: {
            generationParams: {
              aspectRatio: "16:9" as any, // 默认宽高比
              numImages: numImages,
            },
          },
        });

        if (!createResult.success || !createResult.asset) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: createResult.error || "创建素材失败",
          };
          break;
        }

        const assetId = createResult.asset.id;

        // 第二步：创建图片生成任务，只需传入 assetId
        const input: AssetImageGenerationInput = {
          assetId, // 所有信息从 asset 读取
        };

        const jobResult = await createJob({
          userId: session.user.id,
          projectId,
          type: "asset_image_generation",
          inputData: input,
        });

        result = {
          functionCallId: functionCall.id,
          success: true,
          data: {
            assetId, // 返回素材ID，Agent可立即使用
            jobId: jobResult.jobId, // 任务ID用于跟踪
          },
        };
        break;
      }

      case "batch_generate_assets": {
        // 解析 assets 参数，支持数组或 JSON 字符串
        let assetsData: Array<{
          name?: string;
          prompt: string;
          tags?: string | string[];
          sourceAssetIds?: string[];
        }>;
        
        if (Array.isArray(parameters.assets)) {
          assetsData = parameters.assets;
        } else {
          try {
            assetsData = JSON.parse(parameters.assets as string);
          } catch (error) {
            console.error("[executeFunction] 解析 assets 参数失败:", error);
            return {
              functionCallId: functionCall.id,
              success: false,
              error: "assets 参数格式错误",
            };
          }
        }

        const jobIds: string[] = [];
        const assetIds: string[] = [];
        const errors: string[] = [];

        // 为每个素材创建记录和独立的生成任务
        const { createAssetInternal } = await import("../asset/crud");
        
        for (const assetData of assetsData) {
          try {
            // 处理 tags：支持逗号分隔字符串或数组格式
            let parsedTags: string[] | undefined;
            if (assetData.tags) {
              if (Array.isArray(assetData.tags)) {
                parsedTags = assetData.tags;
              } else {
                parsedTags = assetData.tags.split(',').map(t => t.trim()).filter(Boolean);
              }
            }

            // 生成素材名称（如果未提供）
            const assetName = assetData.name || `AI生成-${Date.now()}`;

            // 创建素材记录（包含所有生成信息，但无图片）
            const createResult = await createAssetInternal({
              projectId,
              userId: session.user.id,
              name: assetName,
              prompt: assetData.prompt,
              tags: parsedTags,
              modelUsed: "nano-banana",
              sourceAssetIds: assetData.sourceAssetIds,
              derivationType: assetData.sourceAssetIds ? "img2img" : "generate",
              meta: {
                generationParams: {
                  aspectRatio: "16:9" as any, // 默认宽高比
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

            // 创建图片生成任务，只需传入 assetId
            const input: AssetImageGenerationInput = {
              assetId, // 所有信息从 asset 读取
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
            assetIds, // 返回创建的素材ID列表
            createdCount: jobIds.length,
            totalCount: assetsData.length,
            errors: errors.length > 0 ? errors : undefined,
          },
          error: errors.length > 0 && jobIds.length === 0 
            ? `所有任务创建失败: ${errors.join("; ")}` 
            : undefined,
        };
        break;
      }

      // ============================================
      // 修改类
      // ============================================
      case "update_shot": {
        const updates: Record<string, unknown> = {};
        
        if (parameters.duration) updates.duration = parseInt(parameters.duration as string);
        if (parameters.shotSize) updates.shotSize = parameters.shotSize;
        if (parameters.cameraMovement) updates.cameraMovement = parameters.cameraMovement;
        if (parameters.description) updates.description = parameters.description;
        if (parameters.visualPrompt) updates.visualPrompt = parameters.visualPrompt;
        if (parameters.imageAssetId) updates.imageAssetId = parameters.imageAssetId;

        const updateResult = await updateShot(parameters.shotId as string, updates);

        result = {
          functionCallId: functionCall.id,
          success: updateResult.success,
          error: updateResult.error,
        };
        break;
      }

      case "update_asset": {
        const updates: Record<string, unknown> = {};
        
        if (parameters.name) updates.name = parameters.name;
        // Note: updateAsset 不支持直接更新 tags

        const updateResult = await updateAsset(parameters.assetId as string, updates);

        result = {
          functionCallId: functionCall.id,
          success: updateResult.success,
          error: updateResult.error,
        };
        break;
      }

      case "reorder_shots": {
        // 解析 shotOrders 参数，支持对象或 JSON 字符串
        let shotOrdersRecord: Record<string, number>;
        if (typeof parameters.shotOrders === 'object' && parameters.shotOrders !== null) {
          shotOrdersRecord = parameters.shotOrders as Record<string, number>;
        } else {
          try {
            shotOrdersRecord = JSON.parse(parameters.shotOrders as string);
          } catch (error) {
            console.error("[executeFunction] 解析 shotOrders 参数失败:", error);
            return {
              functionCallId: functionCall.id,
              success: false,
              error: "shotOrders 参数格式错误",
            };
          }
        }
        // 转换为数组格式
        const shotOrdersArray = Object.entries(shotOrdersRecord).map(([id, order]) => ({
          id,
          order,
        }));
        const reorderResult = await reorderShots(
          parameters.episodeId as string,
          shotOrdersArray
        );

        result = {
          functionCallId: functionCall.id,
          success: reorderResult.success,
          error: reorderResult.error,
        };
        break;
      }

      case "set_project_art_style": {
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
        // 解析 shotIds 参数，支持数组或 JSON 字符串
        let shotIds: string[];
        if (Array.isArray(parameters.shotIds)) {
          shotIds = parameters.shotIds;
        } else {
          try {
            shotIds = JSON.parse(parameters.shotIds as string);
          } catch (error) {
            console.error("[executeFunction] 解析 shotIds 参数失败:", error);
            return {
              functionCallId: functionCall.id,
              success: false,
              error: "shotIds 参数格式错误",
            };
          }
        }

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

      case "delete_asset": {
        const deleteResult = await deleteAsset(parameters.assetId as string);

        result = {
          functionCallId: functionCall.id,
          success: deleteResult.success,
          error: deleteResult.error,
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

