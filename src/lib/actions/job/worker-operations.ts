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
        resultData: params.resultData, // JSONB type, no need to stringify
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
        assetId: row.asset_id,
        imageDataId: row.image_data_id,
        videoDataId: row.video_data_id,
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

/**
 * 重新排队任务（用于依赖未就绪的情况）
 * @param jobId - 任务 ID
 * @param retryCount - 重试次数
 * @param waitingFor - 等待的依赖列表
 * @param workerToken - Worker 认证 token（仅供内部 Worker 使用）
 */
export async function requeueJob(
  jobId: string,
  retryCount: number,
  waitingFor: string[],
  workerToken?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  // 验证 Worker 身份
  if (!verifyWorkerToken(workerToken)) {
    console.error("[Security] 未授权的 requeueJob 调用");
    return {
      success: false,
      error: "未授权",
    };
  }

  try {
    // 获取当前任务的 inputData
    const currentJob = await db.query.job.findFirst({
      where: eq(job.id, jobId),
      columns: {
        inputData: true,
      },
    });

    if (!currentJob) {
      return {
        success: false,
        error: "任务不存在",
      };
    }

    // 更新 inputData 中的重试元数据
    const updatedInputData = {
      ...(currentJob.inputData as Record<string, unknown> || {}),
      _retryCount: retryCount,
      _lastRetryAt: new Date().toISOString(),
      _waitingForDependencies: waitingFor,
    };

    // 将任务状态改回 pending，更新元数据和进度消息
    await db
      .update(job)
      .set({
        status: "pending",
        inputData: updatedInputData,
        progressMessage: "等待图片生成...",
        updatedAt: new Date(),
        // 注意：不修改 startedAt，保留原始开始时间
      })
      .where(eq(job.id, jobId));

    return {
      success: true,
    };
  } catch (error) {
    console.error("重新排队任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "重新排队任务失败",
    };
  }
}
