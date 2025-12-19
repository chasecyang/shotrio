"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { shot } from "@/lib/db/schemas/project";
import { eq, asc } from "drizzle-orm";
import type { ShotDetail } from "@/types/project";

/**
 * 刷新单个 shot 数据
 */
export async function refreshShot(shotId: string): Promise<{
  success: boolean;
  shot?: ShotDetail;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, shotId),
      with: {
        imageAsset: true,
        dialogues: {
          orderBy: (shotDialogue, { asc }) => [asc(shotDialogue.order)],
        },
      },
    });

    if (!shotData) {
      return { success: false, error: "分镜不存在" };
    }

    return {
      success: true,
      shot: shotData as ShotDetail,
    };
  } catch (error) {
    console.error("刷新分镜数据失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "刷新失败",
    };
  }
}

/**
 * 刷新剧集的所有 shots
 */
export async function refreshEpisodeShots(episodeId: string): Promise<{
  success: boolean;
  shots?: ShotDetail[];
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const shots = await db.query.shot.findMany({
      where: eq(shot.episodeId, episodeId),
      orderBy: [asc(shot.order)],
      with: {
        imageAsset: true,
        dialogues: {
          orderBy: (shotDialogue, { asc }) => [asc(shotDialogue.order)],
        },
      },
    });

    return {
      success: true,
      shots: shots as ShotDetail[],
    };
  } catch (error) {
    console.error("刷新剧集分镜数据失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "刷新失败",
    };
  }
}

/**
 * 刷新整个项目数据（从 base.ts 复用）
 */
export async function refreshProject(projectId: string) {
  const { getProjectDetail } = await import("./base");
  return getProjectDetail(projectId);
}

