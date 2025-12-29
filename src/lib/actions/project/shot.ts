"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { episode, shot } from "@/lib/db/schemas/project";
import { eq, asc } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  type Shot,
  type NewShot,
  type ShotDetail,
  type ShotSize,
  type CameraMovement,
} from "@/types/project";

/**
 * 获取某剧集的所有分镜（按order排序）
 * 直接查询数据库，依赖客户端刷新机制
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
        shotAssets: {
          with: {
            asset: {
              with: {
                tags: true,
              },
            },
          },
          orderBy: (shotAsset, { asc }) => [asc(shotAsset.order)],
        },
        currentVideo: true,
      },
    });

    return shots as ShotDetail[];
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
  cameraMovement?: CameraMovement;
  duration?: number;
  description?: string;
  visualPrompt?: string;
  audioPrompt?: string;
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
      cameraMovement: data.cameraMovement || "static",
      duration: data.duration || 3000,
      description: data.description || null,
      visualPrompt: data.visualPrompt || null,
      audioPrompt: data.audioPrompt || null,
    };

    const [created] = await db.insert(shot).values(newShot).returning();

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

    return { success: true };
  } catch (error) {
    console.error("重新排序分镜失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "重新排序失败",
    };
  }
}

/**
 * 批量创建分镜
 * 支持指定 order 插入，自动处理 order 冲突
 */
export async function batchCreateShots(data: {
  episodeId: string;
  shots: Array<{
    shotSize: ShotSize;
    description: string;
    order?: number;
    cameraMovement?: CameraMovement;
    duration?: number;
    visualPrompt?: string;
    audioPrompt?: string;
  }>;
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

    if (!data.shots || data.shots.length === 0) {
      throw new Error("分镜数组不能为空");
    }

    // 使用事务确保原子性
    return await db.transaction(async (tx) => {
      // 1. 获取现有分镜，按 order 排序
      const existingShots = await tx.query.shot.findMany({
        where: eq(shot.episodeId, data.episodeId),
        orderBy: [asc(shot.order)],
      });

      // 2. 分离指定了 order 和未指定 order 的分镜
      const shotsWithOrder = data.shots
        .filter((s) => s.order !== undefined)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      const shotsWithoutOrder = data.shots.filter((s) => s.order === undefined);

      // 3. 计算需要移动的范围
      let minOrder: number | undefined;
      let maxOrder: number | undefined;
      const insertCount = shotsWithOrder.length;

      if (shotsWithOrder.length > 0) {
        minOrder = Math.min(...shotsWithOrder.map((s) => s.order!));
        maxOrder = Math.max(...shotsWithOrder.map((s) => s.order!));
      }

      // 4. 调整现有分镜的 order（如果有指定 order 的分镜需要插入）
      if (minOrder !== undefined && insertCount > 0) {
        // 找出所有需要移动的现有分镜（order >= minOrder）
        const shotsToMove = existingShots.filter((s) => s.order >= minOrder!);
        
        // 从后往前更新，避免 order 冲突
        for (let i = shotsToMove.length - 1; i >= 0; i--) {
          const shotToMove = shotsToMove[i];
          const newOrder = shotToMove.order + insertCount;
          await tx
            .update(shot)
            .set({ order: newOrder })
            .where(eq(shot.id, shotToMove.id));
        }
      }

      // 5. 插入指定了 order 的分镜
      const createdShots: Shot[] = [];
      for (const shotData of shotsWithOrder) {
        const newShot: NewShot = {
          id: randomUUID(),
          episodeId: data.episodeId,
          order: shotData.order!,
          shotSize: shotData.shotSize,
          cameraMovement: shotData.cameraMovement || "static",
          duration: shotData.duration || 3000,
          description: shotData.description || null,
          visualPrompt: shotData.visualPrompt || null,
          audioPrompt: shotData.audioPrompt || null,
        };

        const [created] = await tx.insert(shot).values(newShot).returning();
        createdShots.push(created);
      }

      // 6. 插入未指定 order 的分镜
      // 计算下一个可用的 order
      let nextOrder: number;
      if (shotsWithOrder.length > 0 && minOrder !== undefined && maxOrder !== undefined) {
        // 有指定 order 的分镜，需要计算移动后的最大 order
        const maxExistingOrder = existingShots.length > 0
          ? Math.max(...existingShots.map((s) => s.order))
          : 0;
        
        // 如果 maxOrder 超出了现有分镜范围，则没有分镜被移动
        if (maxOrder > maxExistingOrder) {
          // 插入的 order 超出了现有范围，直接使用 maxOrder + 1
          nextOrder = maxOrder + 1;
        } else {
          // 有分镜被移动，计算移动后的最大 order
          const maxOrderAfterMove = maxExistingOrder + insertCount;
          // 取 maxOrder 和移动后最大 order 的较大值，然后 +1
          nextOrder = Math.max(maxOrder, maxOrderAfterMove) + 1;
        }
      } else if (existingShots.length > 0) {
        // 没有指定 order 的分镜，直接从现有最大 order + 1 开始
        nextOrder = existingShots[existingShots.length - 1].order + 1;
      } else {
        // 没有任何现有分镜
        nextOrder = 1;
      }

      for (const shotData of shotsWithoutOrder) {
        const newShot: NewShot = {
          id: randomUUID(),
          episodeId: data.episodeId,
          order: nextOrder++,
          shotSize: shotData.shotSize,
          cameraMovement: shotData.cameraMovement || "static",
          duration: shotData.duration || 3000,
          description: shotData.description || null,
          visualPrompt: shotData.visualPrompt || null,
          audioPrompt: shotData.audioPrompt || null,
        };

        const [created] = await tx.insert(shot).values(newShot).returning();
        createdShots.push(created);
      }

      return {
        success: true,
        data: {
          shots: createdShots,
          createdCount: createdShots.length,
        },
      };
    });
  } catch (error) {
    console.error("批量创建分镜失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "批量创建失败",
    };
  }
}
