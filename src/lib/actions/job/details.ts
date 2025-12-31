"use server";

import type { 
  Job,
  JobType,
} from "@/types/job";

export interface JobDetails {
  id: string;
  type: string;
  displayTitle: string;
  displaySubtitle?: string;
}

/**
 * 获取任务类型的翻译键
 */
function getTaskTypeLabelKey(type: JobType | string): string {
  return `tasks.types.${type}`;
}

/**
 * 获取任务的详细显示信息
 */
export async function getJobDetails(job: Partial<Job>): Promise<JobDetails> {
  const baseDetails: JobDetails = {
    id: job.id!,
    type: job.type!,
    displayTitle: getTaskTypeLabelKey(job.type!),
  };

  if (!job.inputData) {
    return baseDetails;
  }

  try {
    // inputData is now JSONB, no need to parse
    // 根据任务类型添加额外信息（如需要）
    switch (job.type) {
      default:
        break;
    }
  } catch (error) {
    console.error("解析任务详情失败:", error);
  }

  return baseDetails;
}

/**
 * 批量获取任务详情
 */
export async function getJobsDetails(jobs: Partial<Job>[]): Promise<Map<string, JobDetails>> {
  const detailsMap = new Map<string, JobDetails>();
  
  await Promise.all(
    jobs.map(async (job) => {
      if (job.id) {
        const details = await getJobDetails(job);
        detailsMap.set(job.id, details);
      }
    })
  );

  return detailsMap;
}
