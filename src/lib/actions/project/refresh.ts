"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { video } from "@/lib/db/schemas/project";
import { eq, desc } from "drizzle-orm";
import type { Video } from "@/types/project";

/**
 * 刷新单个视频数据
 */
export async function refreshVideo(videoId: string): Promise<{
  success: boolean;
  video?: Video;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const videoData = await db.query.video.findFirst({
      where: eq(video.id, videoId),
    });

    if (!videoData) {
      return { success: false, error: "视频不存在" };
    }

    return {
      success: true,
      video: videoData as Video,
    };
  } catch (error) {
    console.error("刷新视频数据失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "刷新失败",
    };
  }
}

/**
 * 刷新项目的所有视频
 */
export async function refreshProjectVideos(projectId: string): Promise<{
  success: boolean;
  videos?: Video[];
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const videos = await db.query.video.findMany({
      where: eq(video.projectId, projectId),
      orderBy: [desc(video.createdAt)],
    });

    return {
      success: true,
      videos: videos as Video[],
    };
  } catch (error) {
    console.error("刷新项目视频数据失败:", error);
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

