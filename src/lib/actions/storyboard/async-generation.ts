"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { episode } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { createJob } from "@/lib/actions/job";
import type { StoryboardGenerationInput } from "@/types/job";

/**
 * 启动剧本自动拆分分镜任务（异步）
 * 提交后台任务，不阻塞用户操作
 */
export async function startStoryboardGeneration(
  episodeId: string
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证剧集存在且有剧本内容
    const episodeData = await db.query.episode.findFirst({
      where: eq(episode.id, episodeId),
    });

    if (!episodeData) {
      return { success: false, error: "剧集不存在" };
    }

    if (!episodeData.scriptContent || !episodeData.scriptContent.trim()) {
      return { success: false, error: "剧集没有剧本内容，请先编写剧本" };
    }

    // 创建任务
    const input: StoryboardGenerationInput = {
      episodeId,
    };

    const result = await createJob({
      userId: session.user.id,
      projectId: episodeData.projectId,
      type: "storyboard_generation",
      inputData: input,
    });

    if (!result.success || !result.jobId) {
      return { success: false, error: result.error || "创建任务失败" };
    }

    return {
      success: true,
      jobId: result.jobId,
    };
  } catch (error) {
    console.error("启动分镜提取失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "启动分镜提取失败",
    };
  }
}

