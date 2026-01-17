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
import { conversation, project } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import type { ArtStyle } from "@/types/art-style";

/**
 * 获取项目的画风prompt
 * 优先使用新的artStyle，fallback到旧的stylePrompt
 */
async function getProjectStylePrompt(projectId: string): Promise<string | null> {
  const projectData = await db.query.project.findFirst({
    where: eq(project.id, projectId),
    with: { artStyle: true },
  });
  const artStyleData = projectData?.artStyle as ArtStyle | null;
  return artStyleData?.prompt || projectData?.stylePrompt || null;
}

// 导入所有需要的 actions
import {
  updateAsset,
  deleteAsset,
  getVideoAssets,
  createVideoAsset,
  createAudioAsset,
  getAssetWithFullData,
  queryAssets,
  replaceAssetTags,
} from "../asset";
import { createJob } from "../job";
import { getSystemArtStyles } from "../art-style/queries";
import { updateProject } from "../project/base";
import { analyzeAssetsByType } from "../asset/stats";
import {
  createTextAsset,
  getTextAssetContent,
} from "../asset/text-asset";
import {
  getOrCreateProjectTimeline,
  getProjectTimeline,
} from "../timeline/timeline-actions";
import {
  addClipToTimeline,
  removeClip as removeClipAction,
  updateClip as updateClipAction,
  reorderClips,
} from "../timeline/clip-actions";

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
        const includeProjectInfo = parameters.includeProjectInfo !== false; // 默认true
        const includeAssets = parameters.includeAssets !== false; // 默认true
        const includeVideos = parameters.includeVideos !== false; // 默认true
        const includeArtStyles = parameters.includeArtStyles !== false; // 默认true

        const contextData: Record<string, unknown> = {};

        // 包含项目信息
        if (includeProjectInfo) {
          const projectData = await db.query.project.findFirst({
            where: eq(project.id, projectId),
            with: { artStyle: true },
          });

          if (projectData) {
            const artStyleData = projectData.artStyle as ArtStyle | null;
            contextData.projectInfo = {
              title: projectData.title,
              description: projectData.description,
              currentStyle: artStyleData ? {
                id: artStyleData.id,
                name: artStyleData.name,
                prompt: artStyleData.prompt,
              } : null,
            };
          }
        }

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
            : { byType: {}, notReady: 0 };

          // 计算completed和generating数量
          const completedCount = assetsResult.assets.filter(a => a.runtimeStatus === "completed").length;
          const generatingCount = assetsResult.assets.filter(a => a.runtimeStatus !== "completed").length;

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
        
        // 格式化资产信息，只返回Agent决策所需的字段
        const formattedAssets = queryResult.assets.map(a => {
          // 基础字段（所有类型都有）
          const base: Record<string, unknown> = {
            id: a.id,
            name: a.name,
            type: a.assetType,
            status: a.runtimeStatus,
            tags: a.tags.map(t => t.tagValue),
          };

          // 生成信息（仅AI生成的素材）
          if (a.sourceType === 'generated') {
            base.generation = {
              prompt: a.prompt,
              sourceAssetIds: a.sourceAssetIds,
            };
          }

          // 类型特定字段
          if (a.assetType === 'video' || a.assetType === 'audio') {
            base.duration = a.duration;
          } else if (a.assetType === 'text') {
            base.contentPreview = a.textContent?.slice(0, 100) || null;
          }

          return base;
        });
        
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

        // 获取项目画风（用于前置拼接到prompt）
        const stylePrompt = await getProjectStylePrompt(projectId);

        // 为每个素材创建记录和独立的生成任务
        const { createAssetInternal } = await import("../asset/base-crud");

        for (const assetData of assets) {
          try {
            // 生成素材名称（如果未提供）
            const assetName = assetData.name || `AI生成-${Date.now()}`;

            // 前置拼接项目画风到prompt
            const finalPrompt = stylePrompt
              ? `${stylePrompt}. ${assetData.prompt}`
              : assetData.prompt;

            // 创建素材记录（包含所有生成信息，但无图片）
            const createResult = await createAssetInternal({
              projectId,
              userId: session.user.id,
              name: assetName,
              assetType: "image",
              sourceType: "generated",
              tags: assetData.tags,
              imageData: {
                prompt: finalPrompt,
                modelUsed: "nano-banana-pro",
                sourceAssetIds: assetData.sourceAssetIds,
                generationConfig: JSON.stringify({
                  aspectRatio: "16:9",
                  numImages: 1,
                }),
              },
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
              type: "asset_image",
              assetId: assetId,
              imageDataId: createResult.imageDataId,
              inputData: {},
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

          // 获取项目画风并前置拼接到prompt
          const stylePrompt = await getProjectStylePrompt(projectId);
          const finalPrompt = stylePrompt
            ? `${stylePrompt}. ${normalizedConfig.prompt}`
            : (normalizedConfig.prompt as string);

          // 直接使用标准化的配置构建 VideoGenerationConfig（Veo3 固定 8 秒）
          const generationConfig = {
            type: "image-to-video",
            prompt: finalPrompt,
            start_image_url: normalizedConfig.start_image_url as string,
            end_image_url: normalizedConfig.end_image_url as string | undefined,
            aspect_ratio: normalizedConfig.aspect_ratio as "16:9" | "9:16" | undefined,
            negative_prompt: normalizedConfig.negative_prompt as string | undefined,
          };

          // 创建视频生成任务
          const generateResult = await createVideoAsset({
            projectId,
            name: title || "未命名视频",
            prompt: finalPrompt,
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

      case "set_project_info": {
        const { title, description, styleId } = parameters as {
          title?: string;
          description?: string;
          styleId?: string;
        };

        // 至少需要一个字段
        if (!title && !description && !styleId) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: "至少需要提供 title、description 或 styleId 中的一个字段",
          };
          break;
        }

        const updateData: Record<string, string> = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (styleId !== undefined) updateData.styleId = styleId;

        const updateResult = await updateProject(projectId, updateData);

        // 构建更新字段列表用于返回
        const updatedFields: string[] = [];
        if (title !== undefined) updatedFields.push("标题");
        if (description !== undefined) updatedFields.push("描述");
        if (styleId !== undefined) updatedFields.push("美术风格");

        result = {
          functionCallId: functionCall.id,
          success: updateResult.success,
          data: {
            ...updateResult.data,
            updatedFields,
          },
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
        const tags = (parameters.tags as string[]) || [];

        const createResult = await createTextAsset({
          projectId,
          name,
          content,
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

      // ============================================
      // 时间轴剪辑类
      // ============================================
      case "query_timeline": {
        const timelineResult = await getOrCreateProjectTimeline(projectId);

        if (!timelineResult.success || !timelineResult.timeline) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: timelineResult.error || "无法获取或创建时间轴",
          };
          break;
        }

        const timelineData = timelineResult.timeline;

        // 格式化返回数据，包含素材详情
        const formattedClips = timelineData.clips.map((clip) => ({
          id: clip.id,
          order: clip.order,
          startTime: clip.startTime,
          duration: clip.duration,
          trimStart: clip.trimStart,
          trimEnd: clip.trimEnd,
          asset: {
            id: clip.asset.id,
            name: clip.asset.name,
            type: clip.asset.assetType,
            prompt: clip.asset.prompt,
            tags: clip.asset.tags.map((t) => t.tagValue),
            originalDuration: clip.asset.duration,
          },
        }));

        result = {
          functionCallId: functionCall.id,
          success: true,
          data: {
            timeline: {
              id: timelineData.id,
              duration: timelineData.duration,
              clipCount: timelineData.clips.length,
            },
            clips: formattedClips,
            message:
              timelineData.clips.length === 0
                ? "时间轴为空，没有任何片段"
                : `时间轴共 ${timelineData.clips.length} 个片段，总时长 ${Math.round(timelineData.duration / 1000)} 秒`,
          },
        };
        break;
      }

      case "add_clip": {
        const assetId = parameters.assetId as string;
        const duration = parameters.duration as number | undefined;
        const insertAt = parameters.insertAt as string | undefined;
        const trimStart = parameters.trimStart as number | undefined;
        const trimEnd = parameters.trimEnd as number | undefined;

        // 获取或创建时间轴
        const timelineResult = await getOrCreateProjectTimeline(projectId);
        if (!timelineResult.success || !timelineResult.timeline) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: timelineResult.error || "无法获取或创建时间轴",
          };
          break;
        }
        const timelineData = timelineResult.timeline;

        // 获取素材信息以确定时长
        const assetResult = await getAssetWithFullData(assetId);
        if (!assetResult.success || !assetResult.asset) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: assetResult.error || `素材 ${assetId} 不存在`,
          };
          break;
        }
        const assetData = assetResult.asset;

        // 计算片段时长
        let clipDuration = duration;
        if (!clipDuration) {
          if (assetData.assetType === "video" && assetData.duration) {
            clipDuration = assetData.duration;
          } else if (assetData.assetType === "image") {
            result = {
              functionCallId: functionCall.id,
              success: false,
              error: "图片素材必须指定 duration 参数",
            };
            break;
          }
        }

        // 计算插入位置
        let startTime: number | undefined;
        let order: number | undefined;

        if (insertAt === "start") {
          startTime = 0;
          order = 0;
        } else if (insertAt && insertAt !== "end") {
          // insertAt 是 clipId，在该片段后插入
          const targetClip = timelineData.clips.find((c) => c.id === insertAt);
          if (targetClip) {
            startTime = targetClip.startTime + targetClip.duration;
            order = targetClip.order + 1;
          }
        }
        // 默认 'end'：startTime 和 order 使用 addClipToTimeline 的默认值

        const addResult = await addClipToTimeline(timelineData.id, {
          assetId,
          duration: clipDuration,
          startTime,
          order,
          trimStart: trimStart ?? 0,
          trimEnd,
        });

        if (addResult.success) {
          result = {
            functionCallId: functionCall.id,
            success: true,
            data: {
              message: `已添加素材"${assetData.name}"到时间轴`,
              clipCount: addResult.timeline?.clips.length,
              timelineDuration: addResult.timeline?.duration,
            },
          };
        } else {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: addResult.error || "添加片段失败",
          };
        }
        break;
      }

      case "remove_clip": {
        const clipId = parameters.clipId as string;

        const removeResult = await removeClipAction(clipId);

        if (removeResult.success) {
          result = {
            functionCallId: functionCall.id,
            success: true,
            data: {
              message: "已移除片段，后续片段已自动前移",
              clipCount: removeResult.timeline?.clips.length,
              timelineDuration: removeResult.timeline?.duration,
            },
          };
        } else {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: removeResult.error || "移除片段失败",
          };
        }
        break;
      }

      case "update_clip": {
        const clipId = parameters.clipId as string;
        const duration = parameters.duration as number | undefined;
        const trimStart = parameters.trimStart as number | undefined;
        const trimEnd = parameters.trimEnd as number | undefined;
        const moveToPosition = parameters.moveToPosition as number | undefined;
        const replaceWithAssetId = parameters.replaceWithAssetId as string | undefined;

        // 获取时间轴
        const timelineData = await getProjectTimeline(projectId);
        if (!timelineData) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: "时间轴不存在",
          };
          break;
        }

        const updates: string[] = [];

        // 1. 更新基本属性（时长、裁剪点、替换素材）
        const updateInput: {
          duration?: number;
          trimStart?: number;
          trimEnd?: number;
          assetId?: string;
        } = {};

        if (duration !== undefined) {
          updateInput.duration = duration;
          updates.push(`时长改为 ${duration}ms`);
        }
        if (trimStart !== undefined) {
          updateInput.trimStart = trimStart;
          updates.push(`入点改为 ${trimStart}ms`);
        }
        if (trimEnd !== undefined) {
          updateInput.trimEnd = trimEnd;
          updates.push(`出点改为 ${trimEnd}ms`);
        }
        if (replaceWithAssetId !== undefined) {
          // 替换素材需要特殊处理：更新 assetId
          // 注意：现有的 updateClip 不支持直接更新 assetId
          // 这里我们先删除再添加
          const targetClip = timelineData.clips.find((c) => c.id === clipId);
          if (!targetClip) {
            result = {
              functionCallId: functionCall.id,
              success: false,
              error: `片段 ${clipId} 不存在`,
            };
            break;
          }

          // 获取新素材信息
          const newAssetResult = await getAssetWithFullData(replaceWithAssetId);
          if (!newAssetResult.success || !newAssetResult.asset) {
            result = {
              functionCallId: functionCall.id,
              success: false,
              error: newAssetResult.error || `素材 ${replaceWithAssetId} 不存在`,
            };
            break;
          }
          const newAsset = newAssetResult.asset;

          // 删除旧片段
          await removeClipAction(clipId);

          // 添加新片段到相同位置
          await addClipToTimeline(timelineData.id, {
            assetId: replaceWithAssetId,
            duration: duration ?? targetClip.duration,
            startTime: targetClip.startTime,
            order: targetClip.order,
            trimStart: trimStart ?? 0,
            trimEnd,
          });

          updates.push(`素材替换为"${newAsset.name}"`);

          result = {
            functionCallId: functionCall.id,
            success: true,
            data: {
              message: `片段已更新：${updates.join("，")}`,
            },
          };
          break;
        }

        // 执行普通更新
        if (Object.keys(updateInput).length > 0) {
          const updateResult = await updateClipAction(clipId, updateInput);
          if (!updateResult.success) {
            result = {
              functionCallId: functionCall.id,
              success: false,
              error: updateResult.error || "更新片段失败",
            };
            break;
          }
        }

        // 2. 处理移动位置
        if (moveToPosition !== undefined) {
          const currentClip = timelineData.clips.find((c) => c.id === clipId);
          if (!currentClip) {
            result = {
              functionCallId: functionCall.id,
              success: false,
              error: `片段 ${clipId} 不存在`,
            };
            break;
          }

          // 重新排序：将目标片段移到指定位置
          const otherClips = timelineData.clips
            .filter((c) => c.id !== clipId)
            .sort((a, b) => a.order - b.order);

          const newOrder: { clipId: string; order: number }[] = [];
          const insertIndex = Math.min(moveToPosition, otherClips.length);

          for (let i = 0; i < otherClips.length; i++) {
            if (i === insertIndex) {
              newOrder.push({ clipId, order: newOrder.length });
            }
            newOrder.push({ clipId: otherClips[i].id, order: newOrder.length });
          }

          // 如果 insertIndex 等于 otherClips.length，则添加到末尾
          if (insertIndex >= otherClips.length) {
            newOrder.push({ clipId, order: newOrder.length });
          }

          await reorderClips(timelineData.id, newOrder);
          updates.push(`移动到位置 ${moveToPosition}`);
        }

        result = {
          functionCallId: functionCall.id,
          success: true,
          data: {
            message:
              updates.length > 0
                ? `片段已更新：${updates.join("，")}`
                : "没有需要更新的内容",
          },
        };
        break;
      }

      // ============================================
      // 音频生成类
      // ============================================
      case "generate_sound_effect": {
        const prompt = parameters.prompt as string;
        const name = parameters.name as string | undefined;
        const duration = parameters.duration as number | undefined;
        const isLoopable = parameters.is_loopable as boolean | undefined;
        const tags = parameters.tags as string[] | undefined;

        // 参数校验
        if (!prompt || prompt.length < 3) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: "prompt 不能为空且至少 3 个字符",
          };
          break;
        }

        try {
          // 构建 AudioMeta
          const audioMeta = {
            audio: {
              purpose: "sound_effect" as const,
              description: prompt,
              soundEffect: {
                isLoopable: isLoopable,
              },
            },
          };

          // 如果指定了时长，存储到 audioMeta 中
          if (duration !== undefined) {
            audioMeta.audio.soundEffect = {
              ...audioMeta.audio.soundEffect,
              duration: Math.min(Math.max(duration, 0.5), 22),
            } as typeof audioMeta.audio.soundEffect & { duration?: number };
          }

          // 创建音频资产和 Job
          const createResult = await createAudioAsset({
            projectId,
            name: name || `音效-${Date.now()}`,
            prompt: prompt,
            meta: audioMeta,
            tags: tags || ["音效"],
          });

          if (createResult.success && createResult.data) {
            result = {
              functionCallId: functionCall.id,
              success: true,
              data: {
                assetId: createResult.data.asset.id,
                jobId: createResult.data.jobId,
                message: "音效生成任务已创建",
              },
            };
          } else {
            result = {
              functionCallId: functionCall.id,
              success: false,
              error: createResult.error || "创建音效生成任务失败",
            };
          }
        } catch (error) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: error instanceof Error ? error.message : "生成音效失败",
          };
        }
        break;
      }

      case "generate_bgm": {
        const prompt = parameters.prompt as string;
        const name = parameters.name as string | undefined;
        const genre = parameters.genre as string | undefined;
        const mood = parameters.mood as string | undefined;
        const instrumental = (parameters.instrumental as boolean) ?? true;
        const tags = parameters.tags as string[] | undefined;

        if (!prompt || prompt.length < 5) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: "prompt 不能为空且至少 5 个字符",
          };
          break;
        }

        try {
          const audioMeta = {
            audio: {
              purpose: "bgm" as const,
              description: prompt,
              bgm: {
                genre: genre,
                mood: mood,
                hasVocals: !instrumental,
              },
            },
          };

          const createResult = await createAudioAsset({
            projectId,
            name: name || `BGM-${Date.now()}`,
            prompt: prompt,
            meta: audioMeta,
            tags: tags || ["BGM"],
          });

          if (createResult.success && createResult.data) {
            result = {
              functionCallId: functionCall.id,
              success: true,
              data: {
                assetId: createResult.data.asset.id,
                jobId: createResult.data.jobId,
                message: "背景音乐生成任务已创建",
              },
            };
          } else {
            result = {
              functionCallId: functionCall.id,
              success: false,
              error: createResult.error || "创建背景音乐生成任务失败",
            };
          }
        } catch (error) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: error instanceof Error ? error.message : "生成背景音乐失败",
          };
        }
        break;
      }

      case "generate_dialogue": {
        const text = parameters.text as string;
        const voiceId = parameters.voice_id as string;
        const name = parameters.name as string | undefined;
        const emotion = parameters.emotion as string | undefined;
        const speed = parameters.speed as number | undefined;
        const pitch = parameters.pitch as number | undefined;
        const tags = parameters.tags as string[] | undefined;

        // 参数校验
        if (!text || text.length < 1) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: "text 不能为空",
          };
          break;
        }

        if (!voiceId) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: "voice_id 不能为空",
          };
          break;
        }

        // 验证音色 ID
        const { isValidVoiceId, getVoiceDisplayName } = await import(
          "@/lib/config/voices"
        );
        if (!isValidVoiceId(voiceId)) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: `无效的音色 ID: ${voiceId}，请使用系统预设音色`,
          };
          break;
        }

        try {
          const audioMeta = {
            audio: {
              purpose: "voiceover" as const,
              description: text,
              voiceover: {
                voiceId: voiceId,
                emotion: emotion,
                speakingRate: speed,
                pitch: pitch,
                transcript: text,
              },
            },
          };

          const voiceDisplayName = getVoiceDisplayName(voiceId);
          const createResult = await createAudioAsset({
            projectId,
            name: name || `台词-${voiceDisplayName}-${Date.now()}`,
            prompt: text, // prompt 存储原文
            meta: audioMeta,
            tags: tags || ["台词", "配音"],
          });

          if (createResult.success && createResult.data) {
            result = {
              functionCallId: functionCall.id,
              success: true,
              data: {
                assetId: createResult.data.asset.id,
                jobId: createResult.data.jobId,
                message: `台词生成任务已创建（音色：${voiceDisplayName}）`,
              },
            };
          } else {
            result = {
              functionCallId: functionCall.id,
              success: false,
              error: createResult.error || "创建台词生成任务失败",
            };
          }
        } catch (error) {
          result = {
            functionCallId: functionCall.id,
            success: false,
            error: error instanceof Error ? error.message : "生成台词失败",
          };
        }
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
