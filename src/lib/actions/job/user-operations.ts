"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { job } from "@/lib/db/schemas/project";
import { eq, and, desc, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Job, JobStatus } from "@/types/job";

/**
 * 获取用户的所有任务
 */
export async function getUserJobs(options?: {
  status?: JobStatus | JobStatus[];
  projectId?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  jobs?: Job[];
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "未登录",
    };
  }

  try {
    const conditions = [eq(job.userId, session.user.id)];

    if (options?.status) {
      if (Array.isArray(options.status)) {
        conditions.push(inArray(job.status, options.status));
      } else {
        conditions.push(eq(job.status, options.status));
      }
    }

    if (options?.projectId) {
      conditions.push(eq(job.projectId, options.projectId));
    }

    const jobs = await db.query.job.findMany({
      where: and(...conditions),
      orderBy: [desc(job.createdAt)],
      limit: options?.limit || 50,
    });

    return {
      success: true,
      jobs: jobs as Job[],
    };
  } catch (error) {
    console.error("获取用户任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取用户任务失败",
    };
  }
}

/**
 * 取消任务
 */
export async function cancelJob(jobId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "未登录",
    };
  }

  try {
    // 验证任务属于当前用户且状态允许取消
    const jobData = await db.query.job.findFirst({
      where: and(eq(job.id, jobId), eq(job.userId, session.user.id)),
    });

    if (!jobData) {
      return {
        success: false,
        error: "任务不存在或无权限",
      };
    }

    if (jobData.status === "completed" || jobData.status === "failed") {
      return {
        success: false,
        error: "任务已完成，无法取消",
      };
    }

    await db
      .update(job)
      .set({
        status: "cancelled",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(job.id, jobId));

    return {
      success: true,
    };
  } catch (error) {
    console.error("取消任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "取消任务失败",
    };
  }
}

/**
 * 重试失败的任务
 */
export async function retryJob(jobId: string): Promise<{
  success: boolean;
  newJobId?: string;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "未登录",
    };
  }

  try {
    // 获取原任务
    const originalJob = await db.query.job.findFirst({
      where: and(eq(job.id, jobId), eq(job.userId, session.user.id)),
    });

    if (!originalJob) {
      return {
        success: false,
        error: "任务不存在或无权限",
      };
    }

    if (originalJob.status !== "failed" && originalJob.status !== "cancelled") {
      return {
        success: false,
        error: "只能重试失败或已取消的任务",
      };
    }

    // 创建新任务
    const newJobId = randomUUID();
    await db.insert(job).values({
      id: newJobId,
      userId: originalJob.userId,
      projectId: originalJob.projectId,
      type: originalJob.type,
      status: "pending",
      progress: 0,
      currentStep: 0,
      totalSteps: originalJob.totalSteps,
      inputData: originalJob.inputData,
      progressMessage: null,
      resultData: null,
      errorMessage: null,
      isImported: false,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      updatedAt: new Date(),
    });

    return {
      success: true,
      newJobId,
    };
  } catch (error) {
    console.error("重试任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "重试任务失败",
    };
  }
}

/**
 * 标记任务为已导入
 */
export async function markJobAsImported(jobId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "未登录",
    };
  }

  try {
    // 验证任务属于当前用户
    const jobData = await db.query.job.findFirst({
      where: and(eq(job.id, jobId), eq(job.userId, session.user.id)),
    });

    if (!jobData) {
      return {
        success: false,
        error: "任务不存在或无权限",
      };
    }

    // 更新为已导入
    await db
      .update(job)
      .set({
        isImported: true,
        updatedAt: new Date(),
      })
      .where(eq(job.id, jobId));

    return {
      success: true,
    };
  } catch (error) {
    console.error("标记任务为已导入失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "标记任务失败",
    };
  }
}

/**
 * 获取任务详情（包含 inputData 和 resultData）
 * 用于按需获取完整任务数据
 */
export async function getJobDetail(jobId: string): Promise<{
  success: boolean;
  job?: Job;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "未登录",
    };
  }

  try {
    // 获取任务详情
    const jobData = await db.query.job.findFirst({
      where: and(eq(job.id, jobId), eq(job.userId, session.user.id)),
    });

    if (!jobData) {
      return {
        success: false,
        error: "任务不存在或无权限",
      };
    }

    return {
      success: true,
      job: jobData as Job,
    };
  } catch (error) {
    console.error("获取任务详情失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取任务详情失败",
    };
  }
}
