"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { episode } from "@/lib/db/schemas/project";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { type NewEpisode } from "@/types/project";

/**
 * 创建剧集
 */
export async function createEpisode(data: {
  projectId: string;
  title: string;
  summary?: string;
  hook?: string;
  order: number;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const newEpisode: NewEpisode = {
      id: randomUUID(),
      projectId: data.projectId,
      title: data.title,
      summary: data.summary || null,
      hook: data.hook || null,
      scriptContent: null,
      order: data.order,
    };

    const [created] = await db.insert(episode).values(newEpisode).returning();

    revalidatePath(`/projects/${data.projectId}/scripts`);
    return { success: true, data: created };
  } catch (error) {
    console.error("创建剧集失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建失败",
    };
  }
}

/**
 * 更新剧集
 */
export async function updateEpisode(
  episodeId: string,
  data: Partial<NewEpisode>,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const [updated] = await db
      .update(episode)
      .set(data)
      .where(eq(episode.id, episodeId))
      .returning();

    revalidatePath(`/projects/${updated.projectId}/scripts`);
    revalidatePath(`/projects/${updated.projectId}/scripts/${episodeId}`);
    return { success: true, data: updated };
  } catch (error) {
    console.error("更新剧集失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新失败",
    };
  }
}

/**
 * 删除剧集并重新整理所有剧集编号
 */
export async function deleteEpisode(episodeId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const episodeData = await db.query.episode.findFirst({
      where: eq(episode.id, episodeId),
    });

    if (!episodeData) {
      throw new Error("剧集不存在");
    }

    // 使用事务确保原子性
    await db.transaction(async (tx) => {
      // 1. 删除指定剧集
      await tx.delete(episode).where(eq(episode.id, episodeId));

      // 2. 获取该项目的所有剩余剧集（按 order 排序）
      const remainingEpisodes = await tx.query.episode.findMany({
        where: eq(episode.projectId, episodeData.projectId),
        orderBy: [asc(episode.order)],
      });

      // 3. 批量重新编号：将所有剧集的 order 重置为连续的 1, 2, 3...
      // 这样可以处理历史数据编号不连续的情况（如 2,3,4,5,6 -> 1,2,3,4,5）
      const updates = remainingEpisodes.map((ep, index) => {
        const newOrder = index + 1;
        if (ep.order !== newOrder) {
          return tx
            .update(episode)
            .set({ order: newOrder })
            .where(eq(episode.id, ep.id));
        }
        return null;
      }).filter(Boolean);

      // 4. 执行所有更新操作
      if (updates.length > 0) {
        await Promise.all(updates);
      }
    });

    revalidatePath(`/projects/${episodeData.projectId}/scripts`);
    return { success: true };
  } catch (error) {
    console.error("删除剧集失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    };
  }
}
