"use server";

import { nanoid } from "nanoid";
import db from "@/lib/db";
import { timeline, timelineClip } from "@/lib/db/schemas";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type {
  TimelineDetail,
  TimelineClipWithAsset,
  CreateTimelineInput,
  UpdateTimelineInput,
  TrackConfig,
} from "@/types/timeline";
import {
  DEFAULT_TRACKS,
  stringifyTimelineMetadata,
  getTimelineTracks,
} from "@/types/timeline";
import { getProjectAssets } from "../asset";

/**
 * 获取项目的时间轴（获取第一个，UI层面只显示一个）
 */
export async function getProjectTimeline(
  projectId: string
): Promise<TimelineDetail | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      throw new Error("未登录");
    }

    // 查询项目的时间轴
    const timelines = await db
      .select()
      .from(timeline)
      .where(
        and(
          eq(timeline.projectId, projectId),
          eq(timeline.userId, session.user.id)
        )
      )
      .orderBy(desc(timeline.createdAt))
      .limit(1);

    if (timelines.length === 0) {
      return null;
    }

    const timelineData = timelines[0];

    // 查询时间轴的所有片段
    const clips = await db
      .select()
      .from(timelineClip)
      .where(eq(timelineClip.timelineId, timelineData.id))
      .orderBy(timelineClip.order);

    // 获取所有素材数据
    const assets = await getProjectAssets({ projectId });
    const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

    // 组装带素材信息的clips
    const clipsWithAssets: TimelineClipWithAsset[] = clips
      .map((clip) => {
        const asset = assetMap.get(clip.assetId);
        if (!asset) return null;
        return {
          ...clip,
          trimEnd: clip.trimEnd ?? undefined,
          asset,
        } as TimelineClipWithAsset;
      })
      .filter((clip): clip is TimelineClipWithAsset => clip !== null);

    return {
      ...timelineData,
      clips: clipsWithAssets,
    } as TimelineDetail;
  } catch (error) {
    console.error("获取时间轴失败:", error);
    throw error;
  }
}

/**
 * 创建时间轴
 */
export async function createTimeline(
  input: CreateTimelineInput
): Promise<{ success: boolean; timeline?: TimelineDetail; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    const timelineId = nanoid();
    const now = new Date();

    // 初始化默认轨道配置
    const initialMetadata = stringifyTimelineMetadata({
      tracks: DEFAULT_TRACKS,
    });

    await db.insert(timeline).values({
      id: timelineId,
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

    // 返回完整的时间轴数据
    const timelineData = await getProjectTimeline(input.projectId);
    
    if (!timelineData) {
      return { success: false, error: "创建后无法获取时间轴" };
    }

    return { success: true, timeline: timelineData };
  } catch (error) {
    console.error("创建时间轴失败:", error);
    return { success: false, error: "创建时间轴失败" };
  }
}

/**
 * 更新时间轴
 */
export async function updateTimeline(
  timelineId: string,
  input: UpdateTimelineInput
): Promise<{ success: boolean; timeline?: TimelineDetail; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    // 验证时间轴所有权
    const existingTimeline = await db
      .select()
      .from(timeline)
      .where(
        and(eq(timeline.id, timelineId), eq(timeline.userId, session.user.id))
      )
      .limit(1);

    if (existingTimeline.length === 0) {
      return { success: false, error: "时间轴不存在或无权限" };
    }

    // 更新时间轴
    await db
      .update(timeline)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(timeline.id, timelineId));

    // 返回完整的时间轴数据
    const timelineData = await getProjectTimeline(
      existingTimeline[0].projectId
    );

    if (!timelineData) {
      return { success: false, error: "更新后无法获取时间轴" };
    }

    return { success: true, timeline: timelineData };
  } catch (error) {
    console.error("更新时间轴失败:", error);
    return { success: false, error: "更新时间轴失败" };
  }
}

/**
 * 删除时间轴
 */
export async function deleteTimeline(
  timelineId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    // 验证时间轴所有权
    const existingTimeline = await db
      .select()
      .from(timeline)
      .where(
        and(eq(timeline.id, timelineId), eq(timeline.userId, session.user.id))
      )
      .limit(1);

    if (existingTimeline.length === 0) {
      return { success: false, error: "时间轴不存在或无权限" };
    }

    // 删除时间轴（级联删除clips）
    await db.delete(timeline).where(eq(timeline.id, timelineId));

    return { success: true };
  } catch (error) {
    console.error("删除时间轴失败:", error);
    return { success: false, error: "删除时间轴失败" };
  }
}

/**
 * 获取或创建项目的时间轴
 */
export async function getOrCreateProjectTimeline(
  projectId: string
): Promise<{ success: boolean; timeline?: TimelineDetail; error?: string }> {
  try {
    // 先尝试获取现有时间轴
    let timelineData = await getProjectTimeline(projectId);

    // 如果不存在，则创建一个
    if (!timelineData) {
      const result = await createTimeline({ projectId });
      if (!result.success || !result.timeline) {
        return { success: false, error: result.error };
      }
      timelineData = result.timeline;
    }

    return { success: true, timeline: timelineData };
  } catch (error) {
    console.error("获取或创建时间轴失败:", error);
    return { success: false, error: "获取或创建时间轴失败" };
  }
}

/**
 * 更新时间轴的轨道配置
 */
export async function updateTimelineTracks(
  timelineId: string,
  tracks: TrackConfig[]
): Promise<{ success: boolean; timeline?: TimelineDetail; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    // 验证时间轴所有权
    const existingTimeline = await db
      .select()
      .from(timeline)
      .where(
        and(eq(timeline.id, timelineId), eq(timeline.userId, session.user.id))
      )
      .limit(1);

    if (existingTimeline.length === 0) {
      return { success: false, error: "时间轴不存在或无权限" };
    }

    // 更新轨道配置
    const newMetadata = stringifyTimelineMetadata({ tracks });

    await db
      .update(timeline)
      .set({
        metadata: newMetadata,
        updatedAt: new Date(),
      })
      .where(eq(timeline.id, timelineId));

    // 返回完整的时间轴数据
    const timelineData = await getProjectTimeline(
      existingTimeline[0].projectId
    );

    if (!timelineData) {
      return { success: false, error: "更新后无法获取时间轴" };
    }

    return { success: true, timeline: timelineData };
  } catch (error) {
    console.error("更新轨道配置失败:", error);
    return { success: false, error: "更新轨道配置失败" };
  }
}
