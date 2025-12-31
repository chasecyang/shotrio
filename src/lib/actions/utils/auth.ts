"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { project, episode } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";

/**
 * 验证用户已登录，返回用户信息
 * @throws {Error} 如果用户未登录
 */
export async function requireAuth() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.id) {
    throw new Error("未登录");
  }
  
  return {
    userId: session.user.id,
    user: session.user,
  };
}

/**
 * 验证用户对项目的访问权限
 * @throws {Error} 如果项目不存在或用户无权限
 */
export async function requireProjectAccess(projectId: string, userId: string) {
  const projectData = await db.query.project.findFirst({
    where: and(
      eq(project.id, projectId),
      eq(project.userId, userId)
    ),
  });

  if (!projectData) {
    throw new Error("项目不存在或无权限");
  }

  return projectData;
}

/**
 * 验证用户对剧集的访问权限（通过项目权限）
 * @throws {Error} 如果剧集不存在或用户无权限
 */
export async function requireEpisodeAccess(episodeId: string, userId: string) {
  const episodeData = await db.query.episode.findFirst({
    where: eq(episode.id, episodeId),
    with: {
      project: true,
    },
  });

  if (!episodeData) {
    throw new Error("剧集不存在");
  }

  // 类型断言：project 是一个对象
  const projectData = episodeData.project as { userId: string } | undefined;
  if (!projectData || projectData.userId !== userId) {
    throw new Error("无权限访问该剧集");
  }

  return episodeData;
}

/**
 * 组合函数：验证登录并验证项目权限
 * 这是最常用的组合，简化代码
 */
export async function requireAuthAndProject(projectId: string) {
  const { userId } = await requireAuth();
  const projectData = await requireProjectAccess(projectId, userId);
  return { userId, projectData };
}

/**
 * 组合函数：验证登录并验证剧集权限
 */
export async function requireAuthAndEpisode(episodeId: string) {
  const { userId } = await requireAuth();
  const episodeData = await requireEpisodeAccess(episodeId, userId);
  return { userId, episodeData };
}

