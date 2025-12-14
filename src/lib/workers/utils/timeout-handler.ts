"use server";

import db from "@/lib/db";
import { job } from "@/lib/db/schemas/project";
import { eq, and, sql } from "drizzle-orm";
import { failJob } from "@/lib/actions/job/worker-operations";

/**
 * 超时任务处理工具
 * 用于检测和恢复超时的任务
 */

// 任务超时时间配置（分钟）
const TIMEOUT_CONFIG = {
  // 大部分任务10分钟超时
  default: 10,
  // 视频生成任务可能需要更长时间
  video_generation: 30,
  shot_video_generation: 30,
  batch_video_generation: 60,
  final_video_export: 60,
  // AI处理任务
  storyboard_generation: 20,
  storyboard_basic_extraction: 20,
};

/**
 * 获取任务类型的超时时间（分钟）
 */
function getTimeoutMinutes(jobType: string): number {
  return TIMEOUT_CONFIG[jobType as keyof typeof TIMEOUT_CONFIG] || TIMEOUT_CONFIG.default;
}

/**
 * 恢复超时任务
 * 将超过指定时间仍在processing状态的任务标记为失败
 */
export async function recoverTimeoutJobs(workerToken: string): Promise<{
  recovered: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let recovered = 0;

  try {
    // 查询所有processing状态的任务
    const processingJobs = await db.query.job.findMany({
      where: eq(job.status, "processing"),
      columns: {
        id: true,
        type: true,
        startedAt: true,
      },
    });

    const now = new Date();

    for (const jobItem of processingJobs) {
      try {
        if (!jobItem.startedAt) {
          // 如果没有startedAt但是在processing状态，说明有问题
          await failJob(
            {
              jobId: jobItem.id,
              errorMessage: "任务状态异常：缺少开始时间",
            },
            workerToken
          );
          recovered++;
          continue;
        }

        const timeoutMinutes = getTimeoutMinutes(jobItem.type);
        const startedAt = new Date(jobItem.startedAt);
        const elapsedMinutes = (now.getTime() - startedAt.getTime()) / (1000 * 60);

        if (elapsedMinutes > timeoutMinutes) {
          await failJob(
            {
              jobId: jobItem.id,
              errorMessage: `任务超时（${Math.floor(elapsedMinutes)}分钟 > ${timeoutMinutes}分钟限制），已自动取消`,
            },
            workerToken
          );
          recovered++;
          console.log(`[超时恢复] 任务 ${jobItem.id} (${jobItem.type}) 已超时并标记为失败`);
        }
      } catch (error) {
        const errorMsg = `恢复任务 ${jobItem.id} 失败: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[超时恢复] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    if (recovered > 0) {
      console.log(`[超时恢复] 共恢复 ${recovered} 个超时任务`);
    }

    return { recovered, errors };
  } catch (error) {
    console.error("[超时恢复] 扫描超时任务失败:", error);
    return {
      recovered,
      errors: [`扫描失败: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * 检查是否有僵尸任务（没有startedAt但状态为processing）
 * 这些任务可能是由于Worker崩溃导致的
 */
export async function detectZombieJobs(): Promise<string[]> {
  try {
    const zombieJobs = await db.query.job.findMany({
      where: and(
        eq(job.status, "processing"),
        sql`${job.startedAt} IS NULL`
      ),
      columns: {
        id: true,
        type: true,
        createdAt: true,
      },
    });

    return zombieJobs.map((j) => j.id);
  } catch (error) {
    console.error("[僵尸任务检测] 检测失败:", error);
    return [];
  }
}

