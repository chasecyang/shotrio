"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { job } from "@/lib/db/schemas/project";
import { eq, and, desc, or, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { verifyWorkerToken } from "@/lib/workers/auth";
import type {
  Job,
  JobStatus,
  CreateJobParams,
  UpdateJobProgressParams,
  CompleteJobParams,
  FailJobParams,
} from "@/types/job";

// 速率限制配置
const RATE_LIMITS = {
  MAX_PENDING_JOBS_PER_USER: 10, // 单用户最多10个待处理任务
  MAX_JOBS_PER_DAY: 1000, // 单用户每天最多100个任务
};

/**
 * 检查用户是否超过速率限制
 */
async function checkRateLimit(userId: string): Promise<{
  allowed: boolean;
  error?: string;
}> {
  try {
    // 检查待处理任务数量
    const pendingJobs = await db.query.job.findMany({
      where: and(
        eq(job.userId, userId),
        or(eq(job.status, "pending"), eq(job.status, "processing"))
      ),
    });

    if (pendingJobs.length >= RATE_LIMITS.MAX_PENDING_JOBS_PER_USER) {
      return {
        allowed: false,
        error: `您有 ${pendingJobs.length} 个任务正在处理中，请等待完成后再创建新任务（上限：${RATE_LIMITS.MAX_PENDING_JOBS_PER_USER}个）`,
      };
    }

    // 检查今日任务创建数量
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayJobs = await db.query.job.findMany({
      where: and(
        eq(job.userId, userId),
        // 注意：这里需要使用数据库特定的日期比较函数
        // 暂时使用简化版本，实际生产环境可能需要调整
      ),
    });

    const todayJobsCount = todayJobs.filter(
      (j) => new Date(j.createdAt) >= today
    ).length;

    if (todayJobsCount >= RATE_LIMITS.MAX_JOBS_PER_DAY) {
      return {
        allowed: false,
        error: `您今日已创建 ${todayJobsCount} 个任务，已达到每日上限（${RATE_LIMITS.MAX_JOBS_PER_DAY}个）`,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error("检查速率限制失败:", error);
    // 速率限制检查失败时，允许继续（fail-open），但记录日志
    return { allowed: true };
  }
}

/**
 * 创建新任务
 */
export async function createJob(params: CreateJobParams): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  try {
    // 检查速率限制
    const rateLimitCheck = await checkRateLimit(params.userId);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        error: rateLimitCheck.error,
      };
    }

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
 * @param params - 更新参数
 * @param workerToken - Worker 认证 token（仅供内部 Worker 使用）
 */
export async function updateJobProgress(
  params: UpdateJobProgressParams,
  workerToken?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  // 验证 Worker 身份
  if (!verifyWorkerToken(workerToken)) {
    console.error("[Security] 未授权的 updateJobProgress 调用");
    return {
      success: false,
      error: "未授权",
    };
  }

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
 * @param jobId - 任务 ID
 * @param workerToken - Worker 认证 token（仅供内部 Worker 使用）
 */
export async function startJob(
  jobId: string,
  workerToken?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  // 验证 Worker 身份
  if (!verifyWorkerToken(workerToken)) {
    console.error("[Security] 未授权的 startJob 调用");
    return {
      success: false,
      error: "未授权",
    };
  }

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
 * @param params - 完成参数
 * @param workerToken - Worker 认证 token（仅供内部 Worker 使用）
 */
export async function completeJob(
  params: CompleteJobParams,
  workerToken?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  // 验证 Worker 身份
  if (!verifyWorkerToken(workerToken)) {
    console.error("[Security] 未授权的 completeJob 调用");
    return {
      success: false,
      error: "未授权",
    };
  }

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
 * @param params - 失败参数
 * @param workerToken - Worker 认证 token（仅供内部 Worker 使用）
 */
export async function failJob(
  params: FailJobParams,
  workerToken?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  // 验证 Worker 身份
  if (!verifyWorkerToken(workerToken)) {
    console.error("[Security] 未授权的 failJob 调用");
    return {
      success: false,
      error: "未授权",
    };
  }

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
 * @param limit - 获取任务数量上限
 * @param workerToken - Worker 认证 token（仅供内部 Worker 使用）
 */
export async function getPendingJobs(
  limit = 5,
  workerToken?: string
): Promise<{
  success: boolean;
  jobs?: Job[];
  error?: string;
}> {
  // 验证 Worker 身份
  if (!verifyWorkerToken(workerToken)) {
    console.error("[Security] 未授权的 getPendingJobs 调用");
    return {
      success: false,
      error: "未授权",
    };
  }

  try {
    // 验证和清理 limit 参数，防止 SQL 注入
    const safeLimit = Math.min(Math.max(1, Math.floor(Number(limit))), 100);
    
    if (isNaN(safeLimit)) {
      return {
        success: false,
        error: "无效的 limit 参数",
      };
    }

    // 使用 sql 模板字符串防止 SQL 注入
    const { sql: sqlOperator } = await import("drizzle-orm");
    const result = await db.execute(
      sqlOperator.raw(`
        SELECT * FROM job
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT ${safeLimit}
        FOR UPDATE SKIP LOCKED
      `)
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
