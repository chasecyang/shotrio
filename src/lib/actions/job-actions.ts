"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { job } from "@/lib/db/schemas/project";
import { eq, and, desc, or, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import type {
  Job,
  JobStatus,
  CreateJobParams,
  UpdateJobProgressParams,
  CompleteJobParams,
  FailJobParams,
} from "@/types/job";

/**
 * 创建新任务
 */
export async function createJob(params: CreateJobParams): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  try {
    const jobId = randomUUID();

    await db.insert(job).values({
      id: jobId,
      userId: params.userId,
      projectId: params.projectId || null,
      type: params.type,
      status: "pending",
      progress: 0,
      currentStep: 0,
      totalSteps: params.totalSteps || null,
      inputData: JSON.stringify(params.inputData),
      progressMessage: null,
      resultData: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    });

    return {
      success: true,
      jobId,
    };
  } catch (error) {
    console.error("创建任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建任务失败",
    };
  }
}

/**
 * 获取任务状态
 */
export async function getJobStatus(jobId: string): Promise<{
  success: boolean;
  job?: Job;
  error?: string;
}> {
  try {
    const jobData = await db.query.job.findFirst({
      where: eq(job.id, jobId),
    });

    if (!jobData) {
      return {
        success: false,
        error: "任务不存在",
      };
    }

    return {
      success: true,
      job: jobData as Job,
    };
  } catch (error) {
    console.error("获取任务状态失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取任务状态失败",
    };
  }
}

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
 * 获取活跃任务（处理中或等待中）
 */
export async function getActiveJobs(): Promise<{
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
    const jobs = await db.query.job.findMany({
      where: and(
        eq(job.userId, session.user.id),
        or(eq(job.status, "pending"), eq(job.status, "processing"))
      ),
      orderBy: [desc(job.createdAt)],
    });

    return {
      success: true,
      jobs: jobs as Job[],
    };
  } catch (error) {
    console.error("获取活跃任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取活跃任务失败",
    };
  }
}

/**
 * 更新任务进度
 */
export async function updateJobProgress(
  params: UpdateJobProgressParams
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const updateData: Record<string, unknown> = {
      progress: params.progress,
      updatedAt: new Date(),
    };

    if (params.currentStep !== undefined) {
      updateData.currentStep = params.currentStep;
    }

    if (params.progressMessage) {
      updateData.progressMessage = params.progressMessage;
    }

    await db
      .update(job)
      .set(updateData)
      .where(eq(job.id, params.jobId));

    return {
      success: true,
    };
  } catch (error) {
    console.error("更新任务进度失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新任务进度失败",
    };
  }
}

/**
 * 开始处理任务
 */
export async function startJob(jobId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await db
      .update(job)
      .set({
        status: "processing",
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(job.id, jobId));

    return {
      success: true,
    };
  } catch (error) {
    console.error("开始任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "开始任务失败",
    };
  }
}

/**
 * 完成任务
 */
export async function completeJob(params: CompleteJobParams): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await db
      .update(job)
      .set({
        status: "completed",
        progress: 100,
        resultData: JSON.stringify(params.resultData),
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(job.id, params.jobId));

    return {
      success: true,
    };
  } catch (error) {
    console.error("完成任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "完成任务失败",
    };
  }
}

/**
 * 任务失败
 */
export async function failJob(params: FailJobParams): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await db
      .update(job)
      .set({
        status: "failed",
        errorMessage: params.errorMessage,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(job.id, params.jobId));

    return {
      success: true,
    };
  } catch (error) {
    console.error("标记任务失败失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "标记任务失败失败",
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
      startedAt: null,
      completedAt: null,
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
 * 获取等待处理的任务（供 Worker 使用）
 * 使用 FOR UPDATE SKIP LOCKED 实现并发安全的任务获取
 */
export async function getPendingJobs(limit = 5): Promise<{
  success: boolean;
  jobs?: Job[];
  error?: string;
}> {
  try {
    // 使用原始 SQL 来实现 FOR UPDATE SKIP LOCKED
    const result = await db.execute(
      `
      SELECT * FROM job
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
      `
    );

    // 将数据库的蛇形命名转换为驼峰命名
    const jobs = (result.rows || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      type: row.type,
      status: row.status,
      progress: row.progress,
      totalSteps: row.total_steps,
      currentStep: row.current_step,
      progressMessage: row.progress_message,
      inputData: row.input_data,
      resultData: row.result_data,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      updatedAt: row.updated_at,
    })) as Job[];

    return {
      success: true,
      jobs,
    };
  } catch (error) {
    console.error("获取待处理任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取待处理任务失败",
    };
  }
}
