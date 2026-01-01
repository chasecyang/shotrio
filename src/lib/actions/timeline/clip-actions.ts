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

    // 获取当前最大的order值
    const maxOrderResult = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${timelineClip.order}), -1)` })
      .from(timelineClip)
      .where(eq(timelineClip.timelineId, timelineId));

    const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

    // 获取时间轴当前总时长
    const currentTimeline = existingTimeline[0];
    const startTime = input.startTime ?? currentTimeline.duration;

    // 创建片段
    const clipId = nanoid();
    const now = new Date();

    await db.insert(timelineClip).values({
      id: clipId,
      timelineId,
      assetId: input.assetId,
      trackIndex: input.trackIndex ?? 0,
      startTime,
      duration: input.duration ?? 0, // 需要从素材获取实际时长
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

    // 删除片段
    await db.delete(timelineClip).where(eq(timelineClip.id, clipId));

    // 获取剩余片段并重新整理（波纹编辑效果）
    const remainingClips = await db
      .select()
      .from(timelineClip)
      .where(eq(timelineClip.timelineId, timelineId))
      .orderBy(timelineClip.order);

    // 重新计算位置（连续排列，无空隙）
    let currentTime = 0;
    for (let i = 0; i < remainingClips.length; i++) {
      await db
        .update(timelineClip)
        .set({
          startTime: currentTime,
          order: i,
          updatedAt: new Date(),
        })
        .where(eq(timelineClip.id, remainingClips[i].id));
      
      currentTime += remainingClips[i].duration;
    }

    // 更新时间轴总时长
    await db
      .update(timeline)
      .set({ duration: currentTime, updatedAt: new Date() })
      .where(eq(timeline.id, timelineId));

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

