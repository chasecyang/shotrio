"use server";

import { createJob } from "@/lib/actions/job";
import type { JobType } from "@/types/job";
import { requireAuth } from "./auth";

/**
 * 通用的图片生成任务创建函数
 * 适用于角色图片生成、场景图片生成等
 */
export async function createImageGenerationTask(params: {
  projectId: string;
  jobType: JobType;
  inputData: Record<string, unknown>;
  totalSteps?: number;
}): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    // 1. 验证用户登录和项目权限
    const { userId } = await requireAuth();

    // 2. 创建图片生成任务
    const result = await createJob({
      userId,
      projectId: params.projectId,
      type: params.jobType,
      inputData: params.inputData,
      totalSteps: params.totalSteps,
    });

    if (!result.success || !result.jobId) {
      return {
        success: false,
        error: result.error || "创建任务失败",
      };
    }

    return {
      success: true,
      jobId: result.jobId,
    };
  } catch (error) {
    console.error(`创建 ${params.jobType} 任务失败:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建任务失败",
    };
  }
}

