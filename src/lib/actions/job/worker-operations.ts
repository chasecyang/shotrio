"use server";

import db from "@/lib/db";
import { job } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { verifyWorkerToken } from "@/lib/workers/auth";
import type {
  Job,
  UpdateJobProgressParams,
  CompleteJobParams,
  FailJobParams,
} from "@/types/job";

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
