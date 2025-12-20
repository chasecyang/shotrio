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
import { episode, shot } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";

// 导入所有需要的 actions
import { startStoryboardGeneration } from "../storyboard";
import { createShotDecompositionJob } from "../storyboard/decompose-shot";
import { batchGenerateShotImages } from "../project";
import { batchGenerateShotVideos } from "../video/generate";
import { deleteShot, updateShot, reorderShots } from "../project/shot";
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
  functionCall: FunctionCall
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
          projectId: parameters.projectId as string,
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
          with: {
            dialogues: true,
          },
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
          projectId: parameters.projectId as string,
          limit: 1000,
        });

        const assetStats = assetsResult.assets 
          ? analyzeAssetsByType(assetsResult.assets)
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
      // 生成类
      // ============================================
      case "generate_storyboard": {
        const storyboardResult = await startStoryboardGeneration(
          parameters.episodeId as string
        );
        result = {
          functionCallId: functionCall.id,
          success: storyboardResult.success,
          jobId: storyboardResult.jobId,
          error: storyboardResult.error,
        };
        break;
      }

      case "decompose_shot": {
        // 需要episodeId，尝试从分镜获取
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

        const decomposeResult = await createShotDecompositionJob({
          shotId: parameters.shotId as string,
          episodeId: shotData.episodeId,
        });

        result = {
          functionCallId: functionCall.id,
          success: decomposeResult.success,
          jobId: decomposeResult.jobId,
          error: decomposeResult.error,
        };
        break;
      }

      case "batch_decompose_shots": {
        const shotIds = JSON.parse(parameters.shotIds as string) as string[];
        const jobs = [];

        for (const shotId of shotIds) {
          const shotData = await db.query.shot.findFirst({
            where: eq(shot.id, shotId),
          });

          if (shotData) {
            const jobResult = await createShotDecompositionJob({
              shotId,
              episodeId: shotData.episodeId,
            });
            if (jobResult.jobId) {
              jobs.push(jobResult.jobId);
            }
          }
        }

        result = {
          functionCallId: functionCall.id,
          success: true,
          data: { jobIds: jobs, count: jobs.length },
        };
        break;
      }

      case "generate_shot_images": {
        const shotIds = JSON.parse(parameters.shotIds as string) as string[];
        const imageResult = await batchGenerateShotImages(shotIds);

        result = {
          functionCallId: functionCall.id,
          success: imageResult.success,
          jobId: imageResult.jobId,
          error: imageResult.error,
        };
        break;
      }

      case "generate_shot_videos": {
        const shotIds = JSON.parse(parameters.shotIds as string) as string[];
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
        // 构建素材生成输入
        const input: AssetImageGenerationInput = {
          projectId: parameters.projectId as string,
          prompt: parameters.prompt as string,
          numImages: parameters.numImages ? parseInt(parameters.numImages as string) : 1,
        };

        // 可选：Agent 提供的元数据
        if (parameters.name) {
          input.name = parameters.name as string;
        }
        if (parameters.tags) {
          const tagsStr = (parameters.tags as string).trim();
          // 支持 JSON 数组格式和逗号分隔格式
          if (tagsStr.startsWith('[')) {
            input.tags = JSON.parse(tagsStr);
          } else {
            input.tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
          }
        }

        // 可选：参考图（图生图模式）
        if (parameters.sourceAssetIds) {
          input.sourceAssetIds = JSON.parse(parameters.sourceAssetIds as string);
        }

        const jobResult = await createJob({
          userId: session.user.id,
          projectId: parameters.projectId as string,
          type: "asset_image_generation",
          inputData: input,
        });

        result = {
          functionCallId: functionCall.id,
          success: jobResult.success,
          jobId: jobResult.jobId,
          error: jobResult.error,
        };
        break;
      }

      case "batch_generate_assets": {
        const assetsData = JSON.parse(parameters.assets as string) as Array<{
          name?: string;
          prompt: string;
          tags?: string | string[];
          sourceAssetIds?: string[];
        }>;

        const jobIds: string[] = [];
        const errors: string[] = [];

        // 为每个素材创建独立的生成任务
        for (const assetData of assetsData) {
          // 处理 tags：支持逗号分隔字符串或数组格式
          let parsedTags: string[] | undefined;
          if (assetData.tags) {
            if (Array.isArray(assetData.tags)) {
              parsedTags = assetData.tags;
            } else {
              parsedTags = assetData.tags.split(',').map(t => t.trim()).filter(Boolean);
            }
          }

          const input: AssetImageGenerationInput = {
            projectId: parameters.projectId as string,
            prompt: assetData.prompt,
            name: assetData.name,
            tags: parsedTags,
            sourceAssetIds: assetData.sourceAssetIds,
            numImages: 1,
          };

          const jobResult = await createJob({
            userId: session.user.id,
            projectId: parameters.projectId as string,
            type: "asset_image_generation",
            inputData: input,
          });

          if (jobResult.success && jobResult.jobId) {
            jobIds.push(jobResult.jobId);
          } else {
            errors.push(`创建 "${assetData.name || 'unnamed'}" 任务失败: ${jobResult.error || "未知错误"}`);
          }
        }

        result = {
          functionCallId: functionCall.id,
          success: jobIds.length > 0,
          data: {
            jobIds,
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
        if (parameters.visualDescription) updates.visualDescription = parameters.visualDescription;
        if (parameters.visualPrompt) updates.visualPrompt = parameters.visualPrompt;

        const updateResult = await updateShot(parameters.shotId as string, updates);

        result = {
          functionCallId: functionCall.id,
          success: updateResult.success,
          error: updateResult.error,
        };
        break;
      }

      case "batch_update_shot_duration": {
        const shotIds = JSON.parse(parameters.shotIds as string) as string[];
        const duration = parseInt(parameters.duration as string);

        for (const shotId of shotIds) {
          await updateShot(shotId, { duration });
        }

        result = {
          functionCallId: functionCall.id,
          success: true,
          data: { updated: shotIds.length },
        };
        break;
      }

      case "update_asset": {
        const updates: Record<string, unknown> = {};
        
        if (parameters.name) updates.name = parameters.name;
        if (parameters.prompt) updates.prompt = parameters.prompt;
        if (parameters.tags) {
          // Note: updateAsset 不支持直接更新 tags，需要另外处理
          // 这里仅做示例
        }

        const updateResult = await updateAsset(parameters.assetId as string, updates);

        result = {
          functionCallId: functionCall.id,
          success: updateResult.success,
          error: updateResult.error,
        };
        break;
      }

      case "reorder_shots": {
        const shotOrdersRecord = JSON.parse(parameters.shotOrders as string) as Record<
          string,
          number
        >;
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
          parameters.projectId as string,
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
        const shotIds = JSON.parse(parameters.shotIds as string) as string[];

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

      case "delete_assets": {
        const assetIds = JSON.parse(parameters.assetIds as string) as string[];

        for (const assetId of assetIds) {
          await deleteAsset(assetId);
        }

        result = {
          functionCallId: functionCall.id,
          success: true,
          data: { deleted: assetIds.length },
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

/**
 * 批量执行多个 function calls
 */
export async function executeFunctions(
  functionCalls: FunctionCall[]
): Promise<FunctionExecutionResult[]> {
  const results: FunctionExecutionResult[] = [];

  for (const functionCall of functionCalls) {
    const result = await executeFunction(functionCall);
    results.push(result);

    // 如果有任何失败，停止后续执行
    if (!result.success) {
      break;
    }
  }

  return results;
}

