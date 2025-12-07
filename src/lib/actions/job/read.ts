"use server";

import db from "@/lib/db";
import { job } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import type { Job } from "@/types/job";

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
