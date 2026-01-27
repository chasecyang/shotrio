"use server";

import { nanoid } from "nanoid";
import db from "@/lib/db";
import { cutClip, cut } from "@/lib/db/schemas";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type {
  CutDetail,
  AddCutClipInput,
  UpdateCutClipInput,
  ReorderCutClipInput,
} from "@/types/cut";
import { isAudioTrack } from "@/types/cut";
import { getCut } from "./cut-actions";

/**
 * Add clip to cut
 */
export async function addCutClip(
  cutId: string,
  input: AddCutClipInput
): Promise<{ success: boolean; cut?: CutDetail; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Not logged in" };
    }

    // Verify cut ownership
    const existingCut = await db
      .select()
      .from(cut)
      .where(
        and(eq(cut.id, cutId), eq(cut.userId, session.user.id))
      )
      .limit(1);

    if (existingCut.length === 0) {
      return { success: false, error: "Cut not found or no permission" };
    }

    const currentCut = existingCut[0];
    const trackIndex = input.trackIndex ?? 0;

    // 获取该轨道当前最大的 order 值
    const maxOrderResult = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${cutClip.order}), -1)` })
      .from(cutClip)
      .where(
        and(
          eq(cutClip.cutId, cutId),
          eq(cutClip.trackIndex, trackIndex)
        )
      );

    const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

    // 计算起始位置
    let startTime: number;
    if (input.startTime !== undefined) {
      startTime = input.startTime;
    } else {
      // 查询该轨道的最后一个片段，计算轨道末尾位置
      const trackClips = await db
        .select()
        .from(cutClip)
        .where(
          and(
            eq(cutClip.cutId, cutId),
            eq(cutClip.trackIndex, trackIndex)
          )
        )
        .orderBy(cutClip.order);

      if (trackClips.length > 0) {
        const lastClip = trackClips[trackClips.length - 1];
        startTime = lastClip.startTime + lastClip.duration;
      } else {
        startTime = 0;
      }
    }

    // 创建片段
    const clipId = nanoid();
    const now = new Date();

    await db.insert(cutClip).values({
      id: clipId,
      cutId,
      assetId: input.assetId,
      trackIndex,
      startTime: Math.round(startTime),
      duration: Math.round(input.duration ?? 0),
      trimStart: Math.round(input.trimStart ?? 0),
      trimEnd: input.trimEnd !== undefined ? Math.round(input.trimEnd) : undefined,
      order: input.order ?? nextOrder,
      createdAt: now,
      updatedAt: now,
    });

    // 更新剪辑总时长
    const newDuration = startTime + (input.duration ?? 0);
    if (newDuration > currentCut.duration) {
      await db
        .update(cut)
        .set({
          duration: newDuration,
          updatedAt: new Date(),
        })
        .where(eq(cut.id, cutId));
    }

    // Return complete cut data
    const cutData = await getCut(cutId);

    if (!cutData) {
      return { success: false, error: "Failed to get cut after adding" };
    }

    return { success: true, cut: cutData };
  } catch (error) {
    console.error("Failed to add clip:", error);
    return { success: false, error: "Failed to add clip" };
  }
}

/**
 * Update clip
 */
export async function updateCutClip(
  clipId: string,
  input: UpdateCutClipInput
): Promise<{ success: boolean; cut?: CutDetail; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Not logged in" };
    }

    // Query clip and verify ownership
    const existingClip = await db
      .select({
        clip: cutClip,
        cut: cut,
      })
      .from(cutClip)
      .innerJoin(cut, eq(cutClip.cutId, cut.id))
      .where(
        and(eq(cutClip.id, clipId), eq(cut.userId, session.user.id))
      )
      .limit(1);

    if (existingClip.length === 0) {
      return { success: false, error: "Clip not found or no permission" };
    }

    // Convert all numeric fields to integers
    const updateData: Partial<UpdateCutClipInput> = {};
    if (input.trackIndex !== undefined) updateData.trackIndex = Math.round(input.trackIndex);
    if (input.startTime !== undefined) updateData.startTime = Math.round(input.startTime);
    if (input.duration !== undefined) updateData.duration = Math.round(input.duration);
    if (input.trimStart !== undefined) updateData.trimStart = Math.round(input.trimStart);
    if (input.trimEnd !== undefined) updateData.trimEnd = Math.round(input.trimEnd);
    if (input.order !== undefined) updateData.order = Math.round(input.order);
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    // Update clip
    await db
      .update(cutClip)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(cutClip.id, clipId));

    // If position or duration changed, may need to recalculate cut duration
    if (input.startTime !== undefined || input.duration !== undefined) {
      await recalculateCutDuration(existingClip[0].cut.id);
    }

    // Return complete cut data
    const cutData = await getCut(existingClip[0].cut.id);

    if (!cutData) {
      return { success: false, error: "Failed to get cut after update" };
    }

    return { success: true, cut: cutData };
  } catch (error) {
    console.error("Failed to update clip:", error);
    return { success: false, error: "Failed to update clip" };
  }
}

/**
 * Delete clip
 */
export async function removeCutClip(
  clipId: string
): Promise<{ success: boolean; cut?: CutDetail; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Not logged in" };
    }

    // Query clip and verify ownership
    const existingClip = await db
      .select({
        clip: cutClip,
        cut: cut,
      })
      .from(cutClip)
      .innerJoin(cut, eq(cutClip.cutId, cut.id))
      .where(
        and(eq(cutClip.id, clipId), eq(cut.userId, session.user.id))
      )
      .limit(1);

    if (existingClip.length === 0) {
      return { success: false, error: "Clip not found or no permission" };
    }

    const cutId = existingClip[0].cut.id;
    const deletedTrackIndex = existingClip[0].clip.trackIndex;

    // Delete clip
    await db.delete(cutClip).where(eq(cutClip.id, clipId));

    // Audio track: free positioning mode, no ripple reorder
    // Video track: ripple edit, only reorder clips on that track
    if (!isAudioTrack(deletedTrackIndex)) {
      // Get remaining clips on this video track
      const remainingTrackClips = await db
        .select()
        .from(cutClip)
        .where(
          and(
            eq(cutClip.cutId, cutId),
            eq(cutClip.trackIndex, deletedTrackIndex)
          )
        )
        .orderBy(cutClip.order);

      // Recalculate positions for clips on this track (continuous, no gaps)
      let currentTime = 0;
      for (let i = 0; i < remainingTrackClips.length; i++) {
        await db
          .update(cutClip)
          .set({
            startTime: currentTime,
            order: i,
            updatedAt: new Date(),
          })
          .where(eq(cutClip.id, remainingTrackClips[i].id));

        currentTime += remainingTrackClips[i].duration;
      }
    }

    // Recalculate cut duration
    await recalculateCutDuration(cutId);

    // Return complete cut data
    const cutData = await getCut(cutId);

    if (!cutData) {
      return { success: false, error: "Failed to get cut after deletion" };
    }

    return { success: true, cut: cutData };
  } catch (error) {
    console.error("Failed to delete clip:", error);
    return { success: false, error: "Failed to delete clip" };
  }
}

/**
 * Batch reorder clips
 */
export async function reorderCutClips(
  cutId: string,
  clipOrders: ReorderCutClipInput[]
): Promise<{ success: boolean; cut?: CutDetail; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Not logged in" };
    }

    // Verify cut ownership
    const existingCut = await db
      .select()
      .from(cut)
      .where(
        and(eq(cut.id, cutId), eq(cut.userId, session.user.id))
      )
      .limit(1);

    if (existingCut.length === 0) {
      return { success: false, error: "Cut not found or no permission" };
    }

    // Batch update clip order
    for (const clipOrder of clipOrders) {
      const updateData: {
        order: number;
        updatedAt: Date;
        startTime?: number;
      } = {
        order: Math.round(clipOrder.order),
        updatedAt: new Date(),
      };

      if (clipOrder.startTime !== undefined) {
        updateData.startTime = Math.round(clipOrder.startTime);
      }

      await db
        .update(cutClip)
        .set(updateData)
        .where(eq(cutClip.id, clipOrder.clipId));
    }

    // Recalculate cut duration
    await recalculateCutDuration(cutId);

    // Return complete cut data
    const cutData = await getCut(cutId);

    if (!cutData) {
      return { success: false, error: "Failed to get cut after reorder" };
    }

    return { success: true, cut: cutData };
  } catch (error) {
    console.error("Failed to reorder clips:", error);
    return { success: false, error: "Failed to reorder clips" };
  }
}

/**
 * Recalculate cut duration (internal helper function)
 */
async function recalculateCutDuration(cutId: string): Promise<void> {
  const clips = await db
    .select()
    .from(cutClip)
    .where(eq(cutClip.cutId, cutId));

  if (clips.length === 0) {
    await db
      .update(cut)
      .set({ duration: 0, updatedAt: new Date() })
      .where(eq(cut.id, cutId));
    return;
  }

  // Calculate max startTime + duration
  const maxEndTime = Math.max(
    ...clips.map((clip: { startTime: number; duration: number }) => clip.startTime + clip.duration)
  );

  await db
    .update(cut)
    .set({ duration: maxEndTime, updatedAt: new Date() })
    .where(eq(cut.id, cutId));
}
