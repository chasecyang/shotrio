"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { project, episode } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { createJob } from "@/lib/actions/job";
import type { SceneExtractionInput } from "@/types/job";

/**
 * 启动场景提取任务（异步）
 * 提交后台任务，不阻塞用户操作
 */
export async function startSceneExtraction(
  projectId: string
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证项目权限
    const projectData = await db.query.project.findFirst({
      where: and(
        eq(project.id, projectId),
        eq(project.userId, session.user.id)
      ),
      with: {
        episodes: {
          orderBy: [episode.order],
        },
      },
    });

    if (!projectData) {
      return { success: false, error: "项目不存在或无权限" };
    }

    if (!projectData.episodes || projectData.episodes.length === 0) {
      return { success: false, error: "项目中没有剧集内容" };
    }

    // 检查是否有剧本内容
    const episodesWithScript = projectData.episodes.filter(
      (ep) => ep.scriptContent && ep.scriptContent.trim()
    );

    if (episodesWithScript.length === 0) {
      return { success: false, error: "剧集中没有剧本内容" };
    }

    // 获取所有剧集的ID
    const episodeIds = projectData.episodes.map((ep) => ep.id);

    // 创建任务
    const input: SceneExtractionInput = {
      episodeIds,
    };

    const result = await createJob({
      userId: session.user.id,
      projectId,
      type: "scene_extraction",
      inputData: input,
    });

    if (!result.success || !result.job) {
      return { success: false, error: result.error || "创建任务失败" };
    }

    return {
      success: true,
      jobId: result.job.id,
    };
  } catch (error) {
    console.error("启动场景提取任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "启动任务失败",
    };
  }
}

