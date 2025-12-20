"use server";

import db from "@/lib/db";
import { episode } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import type { 
  Job,
  StoryboardGenerationInput,
  StoryboardBasicExtractionInput,
  StoryboardMatchingInput,
  ShotDecompositionResult,
} from "@/types/job";
import { getTaskTypeLabelText } from "@/lib/constants/task-labels";

export interface JobDetails {
  id: string;
  type: string;
  displayTitle: string;
  displaySubtitle?: string;
}

/**
 * 获取任务的详细显示信息
 */
export async function getJobDetails(job: Partial<Job>): Promise<JobDetails> {
  const baseDetails: JobDetails = {
    id: job.id!,
    type: job.type!,
    displayTitle: getTaskTypeLabelText(job.type!),
  };

  if (!job.inputData) {
    return baseDetails;
  }

  try {
    const inputData = JSON.parse(job.inputData);

    switch (job.type) {
      case "storyboard_generation": {
        const input = inputData as StoryboardGenerationInput;
        
        // 查询剧集信息
        const episodeRecord = await db.query.episode.findFirst({
          where: eq(episode.id, input.episodeId),
        });

        if (episodeRecord) {
          baseDetails.displaySubtitle = `剧集: ${episodeRecord.title}`;
        }
        break;
      }

      case "storyboard_basic_extraction": {
        const input = inputData as StoryboardBasicExtractionInput;
        
        // 查询剧集信息
        const episodeRecord = await db.query.episode.findFirst({
          where: eq(episode.id, input.episodeId),
        });

        if (episodeRecord) {
          baseDetails.displaySubtitle = `剧集: ${episodeRecord.title}`;
        }
        break;
      }

      // @deprecated - storyboard_matching 功能已废弃
      case "storyboard_matching": {
        baseDetails.displaySubtitle = "已废弃的任务类型";
        break;
      }

      case "shot_decomposition": {
        // 如果任务已完成，显示拆解结果
        if (job.status === "completed" && job.resultData) {
          try {
            const resultData = JSON.parse(job.resultData) as ShotDecompositionResult;
            const decomposedCount = resultData.decomposedCount || resultData.decomposedShots?.length || 0;
            baseDetails.displayTitle = "分镜拆解";
            baseDetails.displaySubtitle = `已拆解为 ${decomposedCount} 个子分镜`;
          } catch {
            baseDetails.displaySubtitle = "分镜拆解完成";
          }
        } else {
          baseDetails.displaySubtitle = "AI 分析中...";
        }
        break;
      }
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
