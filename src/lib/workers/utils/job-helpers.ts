"use server";

import type { JobType } from "@/types/job";

/**
 * 创建子任务的辅助函数
 */
export async function createChildJob(
  params: {
    userId: string;
    projectId?: string;
    type: JobType;
    inputData: unknown;
    parentJobId?: string;
  }
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    const { createJob } = await import("@/lib/actions/job/create");
    return await createJob({
      userId: params.userId,
      projectId: params.projectId,
      type: params.type,
      inputData: params.inputData,
      parentJobId: params.parentJobId,
    });
  } catch (error) {
    console.error("创建子任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建子任务失败",
    };
  }
}

