"use server";

import { createExtractionTaskForProject } from "@/lib/actions/utils";

/**
 * 启动场景提取任务（异步）
 * 提交后台任务，不阻塞用户操作
 */
export async function startSceneExtraction(
  projectId: string
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  return createExtractionTaskForProject({
    projectId,
    jobType: "scene_extraction",
  });
}

