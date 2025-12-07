"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { episode, shot } from "@/lib/db/schemas/project";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import {
  type NewShot,
  type ShotDetail,
  type ShotSize,
} from "@/types/project";

/**
 * 获取某剧集的所有分镜（按order排序）
 */
export async function getEpisodeShots(
  episodeId: string,
): Promise<ShotDetail[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const shots = await db.query.shot.findMany({
      where: eq(shot.episodeId, episodeId),
      orderBy: [asc(shot.order)],
      with: {
        mainCharacter: true,
      },
    });

    return shots;
  } catch (error) {
    console.error("获取分镜列表失败:", error);
    return [];
  }
}

/**
 * 创建新分镜
 */
export async function createShot(data: {
  episodeId: string;
  order: number;
  shotSize: ShotSize;
  duration?: number;
  visualDescription?: string;
  visualPrompt?: string;
  dialogue?: string;
  audioPrompt?: string;
  mainCharacterId?: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证剧集存在
    const episodeData = await db.query.episode.findFirst({
      where: eq(episode.id, data.episodeId),
    });

    if (!episodeData) {
      throw new Error("剧集不存在");
    }

    const newShot: NewShot = {
      id: randomUUID(),
      episodeId: data.episodeId,
      order: data.order,
      shotSize: data.shotSize,
      duration: data.duration || 3000,
      visualDescription: data.visualDescription || null,
      visualPrompt: data.visualPrompt || null,
      dialogue: data.dialogue || null,
      audioPrompt: data.audioPrompt || null,
      mainCharacterId: data.mainCharacterId || null,
      imageUrl: null,
      videoUrl: null,
      audioUrl: null,
    };

    const [created] = await db.insert(shot).values(newShot).returning();

    revalidatePath(`/projects/${episodeData.projectId}/storyboard`);
    return { success: true, data: created };
  } catch (error) {
    console.error("创建分镜失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建失败",
    };
  }
}

/**
 * 更新分镜信息
 */
export async function updateShot(shotId: string, data: Partial<NewShot>) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const [updated] = await db
      .update(shot)
      .set(data)
      .where(eq(shot.id, shotId))
      .returning();

    // 获取剧集信息以便刷新路径
    const episodeData = await db.query.episode.findFirst({
      where: eq(episode.id, updated.episodeId),
    });

    if (episodeData) {
      revalidatePath(`/projects/${episodeData.projectId}/storyboard`);
    }

    return { success: true, data: updated };
  } catch (error) {
    console.error("更新分镜失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新失败",
    };
  }
}

/**
 * 删除分镜并重新整理所有分镜编号
 */
export async function deleteShot(shotId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, shotId),
    });

    if (!shotData) {
      throw new Error("分镜不存在");
    }

    // 使用事务确保原子性
    await db.transaction(async (tx) => {
      // 1. 删除指定分镜
      await tx.delete(shot).where(eq(shot.id, shotId));

      // 2. 获取该剧集的所有剩余分镜（按 order 排序）
      const remainingShots = await tx.query.shot.findMany({
        where: eq(shot.episodeId, shotData.episodeId),
        orderBy: [asc(shot.order)],
      });

      // 3. 批量重新编号：将所有分镜的 order 重置为连续的 1, 2, 3...
      // 这样可以处理历史数据编号不连续的情况
      const updates = remainingShots.map((s, index) => {
        const newOrder = index + 1;
        if (s.order !== newOrder) {
          return tx
            .update(shot)
            .set({ order: newOrder })
            .where(eq(shot.id, s.id));
        }
        return null;
      }).filter(Boolean);

      // 4. 执行所有更新操作
      if (updates.length > 0) {
        await Promise.all(updates);
      }
    });

    // 获取剧集信息以便刷新路径
    const episodeData = await db.query.episode.findFirst({
      where: eq(episode.id, shotData.episodeId),
    });

    if (episodeData) {
      revalidatePath(`/projects/${episodeData.projectId}/storyboard`);
    }

    return { success: true };
  } catch (error) {
    console.error("删除分镜失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    };
  }
}

/**
 * 批量更新分镜顺序
 */
export async function reorderShots(
  episodeId: string,
  shotOrders: { id: string; order: number }[],
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 批量更新每个分镜的order
    for (const shotOrder of shotOrders) {
      await db
        .update(shot)
        .set({ order: shotOrder.order })
        .where(eq(shot.id, shotOrder.id));
    }

    // 获取剧集信息以便刷新路径
    const episodeData = await db.query.episode.findFirst({
      where: eq(episode.id, episodeId),
    });

    if (episodeData) {
      revalidatePath(`/projects/${episodeData.projectId}/storyboard`);
    }

    return { success: true };
  } catch (error) {
    console.error("重新排序分镜失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "重新排序失败",
    };
  }
}
