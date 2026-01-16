"use server";

import { nanoid } from "nanoid";
import db from "@/lib/db";
import { timelineClip, timeline } from "@/lib/db/schemas";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type {
  TimelineDetail,
  AddClipInput,
  UpdateClipInput,
  ReorderClipInput,
} from "@/types/timeline";
import { isAudioTrack } from "@/types/timeline";
import { getProjectTimeline } from "./timeline-actions";

/**
 * 添加片段到时间轴
 */
export async function addClipToTimeline(
  timelineId: string,
  input: AddClipInput
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

    const currentTimeline = existingTimeline[0];
    const trackIndex = input.trackIndex ?? 0;

    // 获取该轨道当前最大的 order 值
    const maxOrderResult = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${timelineClip.order}), -1)` })
      .from(timelineClip)
      .where(
        and(
          eq(timelineClip.timelineId, timelineId),
          eq(timelineClip.trackIndex, trackIndex)
        )
      );

    const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

    // 计算起始位置
    let startTime: number;
    if (input.startTime !== undefined) {
      // 如果提供了 startTime，直接使用（来自拖拽定位）
      startTime = input.startTime;
    } else {
      // 查询该轨道的最后一个片段，计算轨道末尾位置
      const trackClips = await db
        .select()
        .from(timelineClip)
        .where(
          and(
            eq(timelineClip.timelineId, timelineId),
            eq(timelineClip.trackIndex, trackIndex)
          )
        )
        .orderBy(timelineClip.order);

      if (trackClips.length > 0) {
        const lastClip = trackClips[trackClips.length - 1];
        startTime = lastClip.startTime + lastClip.duration;
      } else {
        startTime = 0; // 轨道为空，从 0 开始
      }
    }

    // 创建片段
    const clipId = nanoid();
    const now = new Date();

    await db.insert(timelineClip).values({
      id: clipId,
      timelineId,
      assetId: input.assetId,
      trackIndex,
      startTime,
      duration: input.duration ?? 0,
      trimStart: input.trimStart ?? 0,
      trimEnd: input.trimEnd,
      order: input.order ?? nextOrder,
      createdAt: now,
      updatedAt: now,
    });

    // 更新时间轴总时长
    const newDuration = startTime + (input.duration ?? 0);
    if (newDuration > currentTimeline.duration) {
      await db
        .update(timeline)
        .set({
          duration: newDuration,
          updatedAt: new Date(),
        })
        .where(eq(timeline.id, timelineId));
    }

    // 返回完整的时间轴数据
    const timelineData = await getProjectTimeline(currentTimeline.projectId);

    if (!timelineData) {
      return { success: false, error: "添加后无法获取时间轴" };
    }

    return { success: true, timeline: timelineData };
  } catch (error) {
    console.error("添加片段失败:", error);
    return { success: false, error: "添加片段失败" };
  }
}

/**
 * 更新片段
 */
export async function updateClip(
  clipId: string,
  input: UpdateClipInput
): Promise<{ success: boolean; timeline?: TimelineDetail; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    // 查询片段并验证所有权
    const existingClip = await db
      .select({
        clip: timelineClip,
        timeline: timeline,
      })
      .from(timelineClip)
      .innerJoin(timeline, eq(timelineClip.timelineId, timeline.id))
      .where(
        and(eq(timelineClip.id, clipId), eq(timeline.userId, session.user.id))
      )
      .limit(1);

    if (existingClip.length === 0) {
      return { success: false, error: "片段不存在或无权限" };
    }

    // 更新片段
    await db
      .update(timelineClip)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(timelineClip.id, clipId));

    // 如果修改了位置或时长，可能需要重新计算时间轴总时长
    if (input.startTime !== undefined || input.duration !== undefined) {
      await recalculateTimelineDuration(existingClip[0].timeline.id);
    }

    // 返回完整的时间轴数据
    const timelineData = await getProjectTimeline(
      existingClip[0].timeline.projectId
    );

    if (!timelineData) {
      return { success: false, error: "更新后无法获取时间轴" };
    }

    return { success: true, timeline: timelineData };
  } catch (error) {
    console.error("更新片段失败:", error);
    return { success: false, error: "更新片段失败" };
  }
}

/**
 * 删除片段
 */
export async function removeClip(
  clipId: string
): Promise<{ success: boolean; timeline?: TimelineDetail; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    // 查询片段并验证所有权
    const existingClip = await db
      .select({
        clip: timelineClip,
        timeline: timeline,
      })
      .from(timelineClip)
      .innerJoin(timeline, eq(timelineClip.timelineId, timeline.id))
      .where(
        and(eq(timelineClip.id, clipId), eq(timeline.userId, session.user.id))
      )
      .limit(1);

    if (existingClip.length === 0) {
      return { success: false, error: "片段不存在或无权限" };
    }

    const timelineId = existingClip[0].timeline.id;
    const projectId = existingClip[0].timeline.projectId;
    const deletedTrackIndex = existingClip[0].clip.trackIndex;

    // 删除片段
    await db.delete(timelineClip).where(eq(timelineClip.id, clipId));

    // 音频轨道：自由定位模式，不进行波纹重排
    // 视频轨道：波纹剪辑，只对该轨道的片段进行重排
    if (!isAudioTrack(deletedTrackIndex)) {
      // 获取该视频轨道的剩余片段
      const remainingTrackClips = await db
        .select()
        .from(timelineClip)
        .where(
          and(
            eq(timelineClip.timelineId, timelineId),
            eq(timelineClip.trackIndex, deletedTrackIndex)
          )
        )
        .orderBy(timelineClip.order);

      // 重新计算该轨道片段的位置（连续排列，无空隙）
      let currentTime = 0;
      for (let i = 0; i < remainingTrackClips.length; i++) {
        await db
          .update(timelineClip)
          .set({
            startTime: currentTime,
            order: i,
            updatedAt: new Date(),
          })
          .where(eq(timelineClip.id, remainingTrackClips[i].id));

        currentTime += remainingTrackClips[i].duration;
      }
    }

    // 重新计算时间轴总时长（基于所有片段的最大结束时间）
    await recalculateTimelineDuration(timelineId);

    // 返回完整的时间轴数据
    const timelineData = await getProjectTimeline(projectId);

    if (!timelineData) {
      return { success: false, error: "删除后无法获取时间轴" };
    }

    return { success: true, timeline: timelineData };
  } catch (error) {
    console.error("删除片段失败:", error);
    return { success: false, error: "删除片段失败" };
  }
}

/**
 * 批量重排序片段
 */
export async function reorderClips(
  timelineId: string,
  clipOrders: ReorderClipInput[]
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

    // 批量更新片段顺序
    for (const clipOrder of clipOrders) {
      const updateData: {
        order: number;
        updatedAt: Date;
        startTime?: number;
      } = {
        order: clipOrder.order,
        updatedAt: new Date(),
      };
      
      if (clipOrder.startTime !== undefined) {
        updateData.startTime = clipOrder.startTime;
      }

      await db
        .update(timelineClip)
        .set(updateData)
        .where(eq(timelineClip.id, clipOrder.clipId));
    }

    // 重新计算时间轴总时长
    await recalculateTimelineDuration(timelineId);

    // 返回完整的时间轴数据
    const timelineData = await getProjectTimeline(
      existingTimeline[0].projectId
    );

    if (!timelineData) {
      return { success: false, error: "重排序后无法获取时间轴" };
    }

    return { success: true, timeline: timelineData };
  } catch (error) {
    console.error("重排序片段失败:", error);
    return { success: false, error: "重排序片段失败" };
  }
}

/**
 * 重新计算时间轴总时长（内部辅助函数）
 */
async function recalculateTimelineDuration(timelineId: string): Promise<void> {
  const clips = await db
    .select()
    .from(timelineClip)
    .where(eq(timelineClip.timelineId, timelineId));

  if (clips.length === 0) {
    // 没有片段，时长为0
    await db
      .update(timeline)
      .set({ duration: 0, updatedAt: new Date() })
      .where(eq(timeline.id, timelineId));
    return;
  }

  // 计算最大的 startTime + duration
  const maxEndTime = Math.max(
    ...clips.map((clip: { startTime: number; duration: number }) => clip.startTime + clip.duration)
  );

  await db
    .update(timeline)
    .set({ duration: maxEndTime, updatedAt: new Date() })
    .where(eq(timeline.id, timelineId));
}

