"use server";

import db from "@/lib/db";
import { job } from "@/lib/db/schemas/project";
import { eq, and, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { CreateJobParams } from "@/types/job";

// 速率限制配置
const RATE_LIMITS = {
  MAX_PENDING_JOBS_PER_USER: 10, // 单用户最多10个待处理任务
  MAX_JOBS_PER_DAY: 1000, // 单用户每天最多1000个任务
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
      assetId: params.assetId || null, // 关联的资产ID（向后兼容）
      imageDataId: params.imageDataId || null, // 关联的图片版本ID
      videoDataId: params.videoDataId || null, // 关联的视频版本ID
      progress: 0,
      currentStep: 0,
      totalSteps: params.totalSteps || null,
      inputData: params.inputData, // JSONB type, no need to stringify
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
