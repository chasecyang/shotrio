"use server";

import { createTaskForEpisode } from "@/lib/actions/utils";

/**
 * 启动剧本自动拆分分镜任务（异步）
 * 提交后台任务，不阻塞用户操作
 */
export async function startStoryboardGeneration(
  episodeId: string
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  return createTaskForEpisode({
    episodeId,
    jobType: "storyboard_generation",
    validateScript: true, // 需要验证剧本内容
  });
}

