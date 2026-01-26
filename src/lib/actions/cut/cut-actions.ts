"use server";

import { nanoid } from "nanoid";
import db from "@/lib/db";
import { cut, cutClip } from "@/lib/db/schemas";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type {
  CutDetail,
  CutClipWithAsset,
  CreateCutInput,
  UpdateCutInput,
  CutListItem,
  TrackConfig,
} from "@/types/cut";
import {
  DEFAULT_TRACKS,
  stringifyCutMetadata,
} from "@/types/cut";
import { getProjectAssets } from "../asset";

/**
 * 获取项目的所有剪辑列表
 */
export async function getProjectCuts(
  projectId: string
): Promise<CutListItem[]> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      throw new Error("未登录");
    }

    // 查询项目的所有剪辑
    const cuts = await db
      .select()
      .from(cut)
      .where(
        and(
          eq(cut.projectId, projectId),
          eq(cut.userId, session.user.id)
        )
      )
      .orderBy(desc(cut.createdAt));

    // 获取每个剪辑的片段数量和缩略图
    const cutListItems: CutListItem[] = [];

    for (const c of cuts) {
      // 获取片段数量
      const clips = await db
        .select()
        .from(cutClip)
        .where(eq(cutClip.cutId, c.id));

      // 获取第一个视频片段的缩略图
      let thumbnailUrl: string | null = null;
      if (clips.length > 0) {
        // 获取第一个片段的素材
        const firstClip = clips.sort((a, b) => a.order - b.order)[0];
        const assets = await getProjectAssets({ projectId });
        const asset = assets.find(a => a.id === firstClip.assetId);
        if (asset?.assetType === "video" && asset.videoDataList?.[0]?.thumbnailUrl) {
          thumbnailUrl = asset.videoDataList[0].thumbnailUrl;
        } else if (asset?.assetType === "image" && asset.imageDataList?.[0]?.thumbnailUrl) {
          thumbnailUrl = asset.imageDataList[0].thumbnailUrl;
        }
      }

      cutListItems.push({
        ...c,
        clipCount: clips.length,
        thumbnailUrl,
      });
    }

    return cutListItems;
  } catch (error) {
    console.error("获取剪辑列表失败:", error);
    throw error;
  }
}

/**
 * 获取单个剪辑详情
 */
export async function getCut(
  cutId: string
): Promise<CutDetail | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      throw new Error("未登录");
    }

    // 查询剪辑
    const cuts = await db
      .select()
      .from(cut)
      .where(
        and(
          eq(cut.id, cutId),
          eq(cut.userId, session.user.id)
        )
      )
      .limit(1);

    if (cuts.length === 0) {
      return null;
    }

    const cutData = cuts[0];

    // 查询剪辑的所有片段
    const clips = await db
      .select()
      .from(cutClip)
      .where(eq(cutClip.cutId, cutData.id))
      .orderBy(cutClip.order);

    // 获取所有素材数据
    const assets = await getProjectAssets({ projectId: cutData.projectId });
    const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

    // 组装带素材信息的clips
    const clipsWithAssets: CutClipWithAsset[] = clips
      .map((clip) => {
        const asset = assetMap.get(clip.assetId);
        if (!asset) return null;
        return {
          ...clip,
          trimEnd: clip.trimEnd ?? undefined,
          asset,
        } as CutClipWithAsset;
      })
      .filter((clip): clip is CutClipWithAsset => clip !== null);

    return {
      ...cutData,
      clips: clipsWithAssets,
    } as CutDetail;
  } catch (error) {
    console.error("获取剪辑详情失败:", error);
    throw error;
  }
}

/**
 * 获取项目的第一个剪辑（向后兼容）
 * @deprecated 使用 getProjectCuts 或 getCut 代替
 */
export async function getProjectTimeline(
  projectId: string
): Promise<CutDetail | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      throw new Error("未登录");
    }

    // 查询项目的第一个剪辑
    const cuts = await db
      .select()
      .from(cut)
      .where(
        and(
          eq(cut.projectId, projectId),
          eq(cut.userId, session.user.id)
        )
      )
      .orderBy(desc(cut.createdAt))
      .limit(1);

    if (cuts.length === 0) {
      return null;
    }

    return getCut(cuts[0].id);
  } catch (error) {
    console.error("获取剪辑失败:", error);
    throw error;
  }
}

/**
 * 创建剪辑
 */
export async function createCut(
  input: CreateCutInput
): Promise<{ success: boolean; cut?: CutDetail; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    const cutId = nanoid();
    const now = new Date();

    // 初始化默认轨道配置
    const initialMetadata = stringifyCutMetadata({
      tracks: DEFAULT_TRACKS,
    });

    await db.insert(cut).values({
      id: cutId,
      projectId: input.projectId,
      userId: session.user.id,
      title: input.title || "未命名剪辑",
      description: input.description,
      duration: 0,
      fps: input.fps || 30,
      resolution: input.resolution || "1080x1920",
      metadata: initialMetadata,
      createdAt: now,
      updatedAt: now,
    });

    // 返回完整的剪辑数据
    const cutData = await getCut(cutId);

    if (!cutData) {
      return { success: false, error: "创建后无法获取剪辑" };
    }

    return { success: true, cut: cutData };
  } catch (error) {
    console.error("创建剪辑失败:", error);
    return { success: false, error: "创建剪辑失败" };
  }
}

/**
 * 创建时间轴（向后兼容别名）
 * @deprecated 使用 createCut 代替
 */
export async function createTimeline(
  input: CreateCutInput
): Promise<{ success: boolean; timeline?: CutDetail; error?: string }> {
  const result = await createCut(input);
  return {
    success: result.success,
    timeline: result.cut,
    error: result.error,
  };
}

/**
 * 更新剪辑
 */
export async function updateCut(
  cutId: string,
  input: UpdateCutInput
): Promise<{ success: boolean; cut?: CutDetail; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    // 验证剪辑所有权
    const existingCut = await db
      .select()
      .from(cut)
      .where(
        and(eq(cut.id, cutId), eq(cut.userId, session.user.id))
      )
      .limit(1);

    if (existingCut.length === 0) {
      return { success: false, error: "剪辑不存在或无权限" };
    }

    // 更新剪辑
    await db
      .update(cut)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(cut.id, cutId));

    // 返回完整的剪辑数据
    const cutData = await getCut(cutId);

    if (!cutData) {
      return { success: false, error: "更新后无法获取剪辑" };
    }

    return { success: true, cut: cutData };
  } catch (error) {
    console.error("更新剪辑失败:", error);
    return { success: false, error: "更新剪辑失败" };
  }
}

/**
 * 更新时间轴（向后兼容别名）
 * @deprecated 使用 updateCut 代替
 */
export async function updateTimeline(
  timelineId: string,
  input: UpdateCutInput
): Promise<{ success: boolean; timeline?: CutDetail; error?: string }> {
  const result = await updateCut(timelineId, input);
  return {
    success: result.success,
    timeline: result.cut,
    error: result.error,
  };
}

/**
 * 删除剪辑
 */
export async function deleteCut(
  cutId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    // 验证剪辑所有权
    const existingCut = await db
      .select()
      .from(cut)
      .where(
        and(eq(cut.id, cutId), eq(cut.userId, session.user.id))
      )
      .limit(1);

    if (existingCut.length === 0) {
      return { success: false, error: "剪辑不存在或无权限" };
    }

    // 删除剪辑（级联删除clips）
    await db.delete(cut).where(eq(cut.id, cutId));

    return { success: true };
  } catch (error) {
    console.error("删除剪辑失败:", error);
    return { success: false, error: "删除剪辑失败" };
  }
}

/**
 * 删除时间轴（向后兼容别名）
 * @deprecated 使用 deleteCut 代替
 */
export async function deleteTimeline(
  timelineId: string
): Promise<{ success: boolean; error?: string }> {
  return deleteCut(timelineId);
}

/**
 * 获取或创建项目的剪辑（向后兼容）
 * @deprecated 使用 getProjectCuts + createCut 代替
 */
export async function getOrCreateProjectTimeline(
  projectId: string
): Promise<{ success: boolean; timeline?: CutDetail; error?: string }> {
  try {
    // 先尝试获取现有剪辑
    let cutData = await getProjectTimeline(projectId);

    // 如果不存在，则创建一个
    if (!cutData) {
      const result = await createCut({ projectId });
      if (!result.success || !result.cut) {
        return { success: false, error: result.error };
      }
      cutData = result.cut;
    }

    return { success: true, timeline: cutData };
  } catch (error) {
    console.error("获取或创建剪辑失败:", error);
    return { success: false, error: "获取或创建剪辑失败" };
  }
}

/**
 * 更新剪辑的轨道配置
 */
export async function updateCutTracks(
  cutId: string,
  tracks: TrackConfig[]
): Promise<{ success: boolean; cut?: CutDetail; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    // 验证剪辑所有权
    const existingCut = await db
      .select()
      .from(cut)
      .where(
        and(eq(cut.id, cutId), eq(cut.userId, session.user.id))
      )
      .limit(1);

    if (existingCut.length === 0) {
      return { success: false, error: "剪辑不存在或无权限" };
    }

    // 更新轨道配置
    const newMetadata = stringifyCutMetadata({ tracks });

    await db
      .update(cut)
      .set({
        metadata: newMetadata,
        updatedAt: new Date(),
      })
      .where(eq(cut.id, cutId));

    // 返回完整的剪辑数据
    const cutData = await getCut(cutId);

    if (!cutData) {
      return { success: false, error: "更新后无法获取剪辑" };
    }

    return { success: true, cut: cutData };
  } catch (error) {
    console.error("更新轨道配置失败:", error);
    return { success: false, error: "更新轨道配置失败" };
  }
}

/**
 * 更新时间轴轨道配置（向后兼容别名）
 * @deprecated 使用 updateCutTracks 代替
 */
export async function updateTimelineTracks(
  timelineId: string,
  tracks: TrackConfig[]
): Promise<{ success: boolean; timeline?: CutDetail; error?: string }> {
  const result = await updateCutTracks(timelineId, tracks);
  return {
    success: result.success,
    timeline: result.cut,
    error: result.error,
  };
}
