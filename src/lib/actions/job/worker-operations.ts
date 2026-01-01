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
 * 更新父任务状态（基于所有子任务的状态）
 * @internal
 */
async function updateParentJobStatus(
  parentJobId: string,
  workerToken?: string
): Promise<void> {
  if (!verifyWorkerToken(workerToken)) {
    console.error("[Security] 未授权的 updateParentJobStatus 调用");
    return;
  }
  try {
    // 查询所有子任务
    const childJobs = await db.query.job.findMany({
      where: eq(job.parentJobId, parentJobId),
      columns: {
        id: true,
        status: true,
        progress: true,
      },
    });

    if (childJobs.length === 0) {
      // 没有子任务，不需要更新
      return;
    }

    // 计算整体状态
    const hasProcessing = childJobs.some(
      (j) => j.status === "pending" || j.status === "processing"
    );
    const hasFailed = childJobs.some((j) => j.status === "failed");
    const allCompleted = childJobs.every((j) => j.status === "completed");
    const allCancelled = childJobs.every((j) => j.status === "cancelled");

    // 计算平均进度
    const avgProgress = Math.floor(
      childJobs.reduce((sum, j) => sum + j.progress, 0) / childJobs.length
    );

    // 决定父任务的状态
    let newStatus: "pending" | "processing" | "completed" | "failed" | "cancelled";
    let progressMessage: string | null = null;

    if (hasFailed) {
      newStatus = "failed";
      const failedCount = childJobs.filter((j) => j.status === "failed").length;
      progressMessage = `${failedCount}/${childJobs.length} 个子任务失败`;
    } else if (allCompleted) {
      newStatus = "completed";
      progressMessage = "所有子任务已完成";
    } else if (allCancelled) {
      newStatus = "cancelled";
    } else if (hasProcessing) {
      newStatus = "processing";
      const completedCount = childJobs.filter((j) => j.status === "completed").length;
      progressMessage = `进行中 (${completedCount}/${childJobs.length} 已完成)`;
    } else {
      newStatus = "pending";
    }

    // 更新父任务
    await db
      .update(job)
      .set({
        status: newStatus,
        progress: newStatus === "completed" ? 100 : avgProgress,
        progressMessage,
        updatedAt: new Date(),
        ...(newStatus === "completed" ? { completedAt: new Date() } : {}),
      })
      .where(eq(job.id, parentJobId));

    console.log(`[父任务同步] 任务 ${parentJobId} 状态更新为 ${newStatus} (进度: ${avgProgress}%)`);
  } catch (error) {
    console.error(`[父任务同步] 更新父任务 ${parentJobId} 失败:`, error);
    // 不抛出错误，避免影响子任务的完成
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
    // 1. 完成当前任务
    await db
      .update(job)
      .set({
        status: "completed",
        progress: 100,
        resultData: params.resultData, // JSONB type, no need to stringify
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(job.id, params.jobId));

    // 2. 查询当前任务的父任务ID
    const currentJob = await db.query.job.findFirst({
      where: eq(job.id, params.jobId),
      columns: {
        parentJobId: true,
      },
    });

    // 3. 如果有父任务，更新父任务状态
    if (currentJob?.parentJobId) {
      await updateParentJobStatus(currentJob.parentJobId, workerToken);
    }

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
    // 1. 标记当前任务为失败
    await db
      .update(job)
      .set({
        status: "failed",
        errorMessage: params.errorMessage,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(job.id, params.jobId));

    // 2. 查询当前任务的父任务ID
    const currentJob = await db.query.job.findFirst({
      where: eq(job.id, params.jobId),
      columns: {
        parentJobId: true,
      },
    });

    // 3. 如果有父任务，更新父任务状态
    if (currentJob?.parentJobId) {
      await updateParentJobStatus(currentJob.parentJobId, workerToken);
    }

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

    // 使用参数化查询防止 SQL 注入
    const { sql: sqlOperator } = await import("drizzle-orm");
    const result = await db.execute(
      sqlOperator`
        SELECT * FROM job
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT ${safeLimit}
        FOR UPDATE SKIP LOCKED
      `
    );

    // 将数据库的蛇形命名转换为驼峰命名
    const jobs = (result.rows || []).map((row: Record<string, unknown>) => {
      // 验证JSONB字段是否正确解析为对象
      if (row.input_data !== null && row.input_data !== undefined) {
        const inputDataType = typeof row.input_data;
        if (inputDataType !== 'object') {
          console.warn(`[getPendingJobs] input_data类型异常: ${inputDataType}, jobId: ${row.id}`);
        }
      }
      if (row.result_data !== null && row.result_data !== undefined) {
        const resultDataType = typeof row.result_data;
        if (resultDataType !== 'object') {
          console.warn(`[getPendingJobs] result_data类型异常: ${resultDataType}, jobId: ${row.id}`);
        }
      }
      
      return {
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
        isImported: row.is_imported,
        createdAt: row.created_at,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        updatedAt: row.updated_at,
      };
    }) as Job[];

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
