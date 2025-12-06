"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { project, episode, character, shot } from "@/lib/db/schemas/project";
import { eq, and, desc, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import {
  type NewProject,
  type NewEpisode,
  type NewCharacter,
  type NewShot,
  type ProjectWithStats,
  type ProjectDetail,
  type ShotDetail,
  type ShotSize,
} from "@/types/project";

// ============================================
// 项目 (Project) 相关操作
// ============================================

/**
 * 创建新项目
 */
export async function createProject(data: {
  title: string;
  description?: string;
  stylePrompt?: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const newProject: NewProject = {
      id: randomUUID(),
      userId: session.user.id,
      title: data.title,
      description: data.description,
      stylePrompt: data.stylePrompt,
      status: "draft",
    };

    const [created] = await db.insert(project).values(newProject).returning();

    revalidatePath("/projects");
    return { success: true, data: created };
  } catch (error) {
    console.error("创建项目失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建失败",
    };
  }
}

/**
 * 获取用户的所有项目（带统计数据）
 */
export async function getUserProjects(): Promise<ProjectWithStats[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return [];
  }

  try {
    const projects = await db.query.project.findMany({
      where: eq(project.userId, session.user.id),
      orderBy: [desc(project.updatedAt)],
      with: {
        episodes: true,
        characters: true,
      },
    });

    return projects.map((p) => ({
      ...p,
      episodeCount: p.episodes.length,
      characterCount: p.characters.length,
    }));
  } catch (error) {
    console.error("获取项目列表失败:", error);
    return [];
  }
}

/**
 * 获取项目详情（含剧集和角色）
 */
export async function getProjectDetail(
  projectId: string,
): Promise<ProjectDetail | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const projectData = await db.query.project.findFirst({
      where: and(
        eq(project.id, projectId),
        eq(project.userId, session.user.id),
      ),
      with: {
        episodes: {
          orderBy: (episodes, { asc }) => [asc(episodes.order)],
        },
        characters: {
          with: {
            images: {
              orderBy: (images, { desc }) => [desc(images.isPrimary), desc(images.createdAt)],
            },
          },
        },
      },
    });

    return projectData || null;
  } catch (error) {
    console.error("获取项目详情失败:", error);
    return null;
  }
}

/**
 * 更新项目
 */
export async function updateProject(
  projectId: string,
  data: Partial<NewProject>,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const [updated] = await db
      .update(project)
      .set(data)
      .where(and(eq(project.id, projectId), eq(project.userId, session.user.id)))
      .returning();

    revalidatePath(`/projects/${projectId}`);
    return { success: true, data: updated };
  } catch (error) {
    console.error("更新项目失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新失败",
    };
  }
}

/**
 * 删除项目
 */
export async function deleteProject(projectId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    await db
      .delete(project)
      .where(
        and(eq(project.id, projectId), eq(project.userId, session.user.id)),
      );

    revalidatePath("/projects");
    return { success: true };
  } catch (error) {
    console.error("删除项目失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    };
  }
}


// ============================================
// 剧集 (Episode) 相关操作
// ============================================

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

/**
 * 在指定位置后插入剧集并重新整理所有剧集编号
 */
export async function insertEpisodeAfter(data: {
  projectId: string;
  title: string;
  summary?: string;
  hook?: string;
  afterOrder: number; // 在这个order之后插入
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    let createdEpisode: NewEpisode & { id: string };

    // 使用事务确保原子性
    await db.transaction(async (tx) => {
      // 1. 获取该项目的所有剧集（按 order 排序）
      const existingEpisodes = await tx.query.episode.findMany({
        where: eq(episode.projectId, data.projectId),
        orderBy: [asc(episode.order)],
      });

      // 2. 创建新剧集（临时使用一个很大的 order，避免冲突）
      const newEpisode: NewEpisode = {
        id: randomUUID(),
        projectId: data.projectId,
        title: data.title,
        summary: data.summary || null,
        hook: data.hook || null,
        scriptContent: null,
        order: 999999, // 临时值
      };

      const [created] = await tx.insert(episode).values(newEpisode).returning();
      createdEpisode = created;

      // 3. 将新剧集插入到正确的位置，并重新整理所有编号
      const allEpisodes = [...existingEpisodes, created];
      
      // 找到插入位置的索引
      const insertIndex = existingEpisodes.findIndex(ep => ep.order > data.afterOrder);
      const sortedEpisodes = insertIndex === -1
        ? [...existingEpisodes, created] // 插入到末尾
        : [
            ...existingEpisodes.slice(0, insertIndex),
            created,
            ...existingEpisodes.slice(insertIndex),
          ];

      // 4. 批量更新所有剧集的 order 为连续的 1, 2, 3...
      const updates = sortedEpisodes.map((ep, index) => {
        const newOrder = index + 1;
        return tx
          .update(episode)
          .set({ order: newOrder })
          .where(eq(episode.id, ep.id));
      });

      await Promise.all(updates);
    });

    revalidatePath(`/projects/${data.projectId}/scripts`);
    return { success: true, data: createdEpisode! };
  } catch (error) {
    console.error("插入剧集失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "插入失败",
    };
  }
}

/**
 * 重新整理项目的所有剧集编号（用于修复历史数据）
 * 将所有剧集的 order 重置为连续的 1, 2, 3...
 */
export async function reorderEpisodes(projectId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证项目权限
    const projectData = await db.query.project.findFirst({
      where: and(
        eq(project.id, projectId),
        eq(project.userId, session.user.id),
      ),
    });

    if (!projectData) {
      throw new Error("项目不存在或无权访问");
    }

    // 使用事务确保原子性
    await db.transaction(async (tx) => {
      // 获取该项目的所有剧集（按 order 排序）
      const episodes = await tx.query.episode.findMany({
        where: eq(episode.projectId, projectId),
        orderBy: [asc(episode.order)],
      });

      // 批量更新所有剧集的 order 为连续的 1, 2, 3...
      const updates = episodes.map((ep, index) => {
        const newOrder = index + 1;
        if (ep.order !== newOrder) {
          return tx
            .update(episode)
            .set({ order: newOrder })
            .where(eq(episode.id, ep.id));
        }
        return null;
      }).filter(Boolean);

      // 执行所有更新操作
      if (updates.length > 0) {
        await Promise.all(updates);
      }
    });

    revalidatePath(`/projects/${projectId}/scripts`);
    return { success: true };
  } catch (error) {
    console.error("重新整理剧集编号失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "重新整理失败",
    };
  }
}

// ============================================
// 角色 (Character) 相关操作
// ============================================

/**
 * 创建角色
 */
export async function createCharacter(data: {
  projectId: string;
  name: string;
  description?: string;
  appearance?: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const newCharacter: NewCharacter = {
      id: randomUUID(),
      projectId: data.projectId,
      name: data.name,
      description: data.description,
      appearance: data.appearance,
    };

    const [created] = await db
      .insert(character)
      .values(newCharacter)
      .returning();

    revalidatePath(`/projects/${data.projectId}`);
    return { success: true, data: created };
  } catch (error) {
    console.error("创建角色失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建失败",
    };
  }
}

/**
 * 更新角色
 */
export async function updateCharacter(
  characterId: string,
  data: Partial<NewCharacter>,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const [updated] = await db
      .update(character)
      .set(data)
      .where(eq(character.id, characterId))
      .returning();

    revalidatePath(`/projects/${updated.projectId}`);
    return { success: true, data: updated };
  } catch (error) {
    console.error("更新角色失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新失败",
    };
  }
}

/**
 * 删除角色
 */
export async function deleteCharacter(characterId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const characterData = await db.query.character.findFirst({
      where: eq(character.id, characterId),
    });

    if (!characterData) {
      throw new Error("角色不存在");
    }

    await db.delete(character).where(eq(character.id, characterId));

    revalidatePath(`/projects/${characterData.projectId}`);
    return { success: true };
  } catch (error) {
    console.error("删除角色失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    };
  }
}

// ============================================
// 分镜 (Shot) 相关操作
// ============================================

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


