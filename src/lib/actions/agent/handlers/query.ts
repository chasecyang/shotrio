"use server";

/**
 * 查询类处理器
 *
 * 处理 query_context, query_assets, query_cut, query_text_assets
 */

import type { FunctionCall, FunctionExecutionResult } from "@/types/agent";
import db from "@/lib/db";
import { project } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { getVideoAssets, queryAssets } from "@/lib/actions/asset";
import { getSystemArtStyles } from "@/lib/actions/art-style/queries";
import { analyzeAssetsByType } from "@/lib/actions/asset/stats";
import { getTextAssetContent } from "@/lib/actions/asset/text-asset";
import { createCut, getProjectCuts, getCut } from "@/lib/actions/cut";
import { getCutTracks, type CutClipWithAsset, type TrackConfig } from "@/types/cut";

/**
 * 统一的查询类处理器
 */
export async function handleQueryFunctions(
  functionCall: FunctionCall,
  projectId: string
): Promise<FunctionExecutionResult> {
  const { name, parameters } = functionCall;

  switch (name) {
    case "query_context":
      return handleQueryContext(functionCall, projectId, parameters);
    case "query_assets":
      return handleQueryAssets(functionCall, projectId, parameters);
    case "query_cuts":
      return handleQueryCuts(functionCall, projectId);
    case "query_cut":
      return handleQueryCut(functionCall, projectId, parameters);
    case "query_text_assets":
      return handleQueryTextAssets(functionCall, projectId, parameters);
    default:
      return {
        functionCallId: functionCall.id,
        success: false,
        error: `未知的查询函数: ${name}`,
      };
  }
}

/**
 * 查询项目上下文
 */
async function handleQueryContext(
  functionCall: FunctionCall,
  projectId: string,
  parameters: Record<string, unknown>
): Promise<FunctionExecutionResult> {
  const includeProjectInfo = parameters.includeProjectInfo !== false;
  const includeAssets = parameters.includeAssets !== false;
  const includeVideos = parameters.includeVideos !== false;
  const includeArtStyles = parameters.includeArtStyles !== false;

  const contextData: Record<string, unknown> = {};

  // 包含项目信息
  if (includeProjectInfo) {
    const projectData = await db.query.project.findFirst({
      where: eq(project.id, projectId),
    });

    if (projectData) {
      contextData.projectInfo = {
        title: projectData.title,
        description: projectData.description,
        stylePrompt: projectData.stylePrompt || null,
      };
    }
  }

  // 包含视频列表
  if (includeVideos) {
    const videosResult = await getVideoAssets(projectId, { orderBy: "created" });
    const videos = videosResult.videos || [];
    const completedVideos = videos.filter((v) => v.runtimeStatus === "completed");
    const processingVideos = videos.filter(
      (v) => v.runtimeStatus === "processing" || v.runtimeStatus === "pending"
    );

    contextData.videos = {
      total: videos.length,
      completed: completedVideos.length,
      processing: processingVideos.length,
      list: videos.map((v) => ({
        id: v.id,
        prompt: v.prompt,
        name: v.name,
        status: v.runtimeStatus,
        duration: v.duration,
        tags: v.tags.map((t) => t.tagValue),
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
      : { byType: {} };

    const completedCount = assetsResult.assets.filter(
      (a) => a.runtimeStatus === "completed"
    ).length;
    const generatingCount = assetsResult.assets.filter(
      (a) => a.runtimeStatus !== "completed"
    ).length;

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

  return {
    functionCallId: functionCall.id,
    success: true,
    data: contextData,
  };
}

/**
 * 查询资产
 */
async function handleQueryAssets(
  functionCall: FunctionCall,
  projectId: string,
  parameters: Record<string, unknown>
): Promise<FunctionExecutionResult> {
  const tagArray = parameters.tags as string[] | undefined;
  const assetType = parameters.assetType as "image" | "video" | undefined;
  const queryResult = await queryAssets({
    projectId,
    assetType,
    tagFilters: tagArray,
    limit: (parameters.limit as number) || 20,
  });

  // 统计状态
  const completedCount = queryResult.assets.filter(
    (a) => a.runtimeStatus === "completed"
  ).length;
  const processingCount = queryResult.assets.filter(
    (a) => a.runtimeStatus === "processing"
  ).length;
  const failedCount = queryResult.assets.filter(
    (a) => a.runtimeStatus === "failed"
  ).length;

  const typeLabel =
    assetType === "image"
      ? "图片资产"
      : assetType === "video"
        ? "视频资产"
        : "资产";

  // 格式化资产信息，只返回Agent决策所需的字段
  const formattedAssets = queryResult.assets.map((a) => {
    const base: Record<string, unknown> = {
      id: a.id,
      name: a.name,
      type: a.assetType,
      status: a.runtimeStatus,
      selectionStatus: a.selectionStatus,
      tags: a.tags.map((t) => t.tagValue),
    };

    if (a.sourceType === "generated") {
      base.generation = {
        prompt: a.prompt,
        sourceAssetIds: a.sourceAssetIds,
      };
    }

    if (a.assetType === "video" || a.assetType === "audio") {
      base.duration = a.duration;
    } else if (a.assetType === "text") {
      base.contentPreview = a.textContent?.slice(0, 100) || null;
    }

    return base;
  });

  return {
    functionCallId: functionCall.id,
    success: true,
    data: {
      assets: formattedAssets,
      total: queryResult.total,
      completed: completedCount,
      processing: processingCount,
      failed: failedCount,
      message:
        queryResult.assets.length === 0
          ? `${typeLabel}库为空，没有找到任何${typeLabel}`
          : `找到 ${queryResult.total} 个${typeLabel}（${completedCount} 个已完成，${processingCount} 个处理中${failedCount > 0 ? `，${failedCount} 个失败` : ""}）`,
    },
  };
}

/**
 * 查询项目所有剪辑列表
 */
async function handleQueryCuts(
  functionCall: FunctionCall,
  projectId: string
): Promise<FunctionExecutionResult> {
  const cuts = await getProjectCuts(projectId);

  const formattedCuts = cuts.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    duration: c.duration,
    clipCount: c.clipCount,
    resolution: c.resolution,
    fps: c.fps,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));

  return {
    functionCallId: functionCall.id,
    success: true,
    data: {
      cuts: formattedCuts,
      total: cuts.length,
      message:
        cuts.length === 0
          ? "项目还没有剪辑，可以使用 create_cut 创建一个"
          : `项目共有 ${cuts.length} 个剪辑`,
    },
  };
}

/**
 * 查询剪辑
 */
async function handleQueryCut(
  functionCall: FunctionCall,
  projectId: string,
  parameters: Record<string, unknown>
): Promise<FunctionExecutionResult> {
  const cutId = parameters.cutId as string | undefined;

  let cutData;
  if (cutId) {
    // 查询指定的剪辑
    cutData = await getCut(cutId);
    if (!cutData) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: `剪辑 ${cutId} 不存在`,
      };
    }
  } else {
    // 获取项目的第一个剪辑
    const cuts = await getProjectCuts(projectId);
    if (cuts.length > 0) {
      cutData = await getCut(cuts[0].id);
    }

    // 如果不存在，则创建一个
    if (!cutData) {
      const result = await createCut({ projectId });
      if (!result.success || !result.cut) {
        return {
          functionCallId: functionCall.id,
          success: false,
          error: result.error || "无法获取或创建剪辑",
        };
      }
      cutData = result.cut;
    }
  }

  // 解析轨道配置
  const trackConfigs = getCutTracks(cutData.metadata);

  // 格式化返回数据，包含 trackIndex 和素材详情
  const formattedClips = cutData.clips.map((clip: CutClipWithAsset) => ({
    id: clip.id,
    trackIndex: clip.trackIndex,
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
      tags: clip.asset.tags.map((t: { tagValue: string }) => t.tagValue),
      originalDuration: clip.asset.duration,
    },
  }));

  // 按轨道分组统计
  const videoClips = formattedClips.filter((c: { trackIndex: number }) => c.trackIndex < 100);
  const audioClips = formattedClips.filter((c: { trackIndex: number }) => c.trackIndex >= 100);

  return {
    functionCallId: functionCall.id,
    success: true,
    data: {
      cut: {
        id: cutData.id,
        duration: cutData.duration,
        clipCount: cutData.clips.length,
      },
      tracks: trackConfigs.map((t: TrackConfig) => ({
        index: t.index,
        type: t.type,
        name: t.name,
      })),
      clips: formattedClips,
      summary: {
        videoClips: videoClips.length,
        audioClips: audioClips.length,
      },
      message:
        cutData.clips.length === 0
          ? "剪辑为空，没有任何片段"
          : `剪辑共 ${cutData.clips.length} 个片段（视频${videoClips.length}个，音频${audioClips.length}个），总时长 ${Math.round(cutData.duration / 1000)} 秒`,
    },
  };
}

/**
 * 查询文本资产
 */
async function handleQueryTextAssets(
  functionCall: FunctionCall,
  projectId: string,
  parameters: Record<string, unknown>
): Promise<FunctionExecutionResult> {
  const tags = parameters.tags as string[] | undefined;
  const limit = (parameters.limit as number) || 10;

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
        tags: asset.tags.map((t) => t.tagValue),
        createdAt: asset.createdAt,
      };
    })
  );

  return {
    functionCallId: functionCall.id,
    success: true,
    data: {
      assets: textAssets,
      total: queryResult.total,
      message:
        textAssets.length === 0
          ? "没有找到文本资产"
          : `找到 ${textAssets.length} 个文本资产`,
    },
  };
}
