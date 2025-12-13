"use server";

import { startJob, updateJobProgress, completeJob, failJob } from "@/lib/actions/job";
import { getWorkerToken } from "@/lib/workers/auth";
import type { Job } from "@/types/job";

// 导入各个处理器
import { processCharacterExtraction } from "./processors/character-extraction";
import { processSceneExtraction } from "./processors/scene-extraction";
import { processCharacterImageGeneration } from "./processors/character-image-generation";
import { processSceneImageGeneration } from "./processors/scene-image-generation";
import {
  processStoryboardGeneration,
  processStoryboardBasicExtraction,
  processStoryboardMatching,
} from "./processors/storyboard-processors";
import {
  processVideoGeneration,
  processShotVideoGeneration,
  processBatchVideoGeneration,
  processFinalVideoExport,
} from "./processors/video-processors";

/**
 * 处理单个任务
 */
export async function processJob(jobData: Job): Promise<void> {
  const workerToken = getWorkerToken();
  
  try {
    // 标记任务为处理中
    await startJob(jobData.id, workerToken);

    // 根据任务类型调用对应的处理函数
    switch (jobData.type) {
      case "character_extraction":
        await processCharacterExtraction(jobData, workerToken);
        break;
      case "scene_extraction":
        await processSceneExtraction(jobData, workerToken);
        break;
      case "character_image_generation":
        await processCharacterImageGeneration(jobData, workerToken);
        break;
      case "scene_image_generation":
        await processSceneImageGeneration(jobData, workerToken);
        break;
      case "storyboard_generation":
        await processStoryboardGeneration(jobData, workerToken);
        break;
      case "storyboard_basic_extraction":
        await processStoryboardBasicExtraction(jobData, workerToken);
        break;
      case "storyboard_matching":
        await processStoryboardMatching(jobData, workerToken);
        break;
      case "batch_image_generation":
        await processBatchImageGeneration(jobData, workerToken);
        break;
      case "video_generation":
        await processVideoGeneration(jobData, workerToken);
        break;
      case "shot_video_generation":
        await processShotVideoGeneration(jobData, workerToken);
        break;
      case "batch_video_generation":
        await processBatchVideoGeneration(jobData, workerToken);
        break;
      case "final_video_export":
        await processFinalVideoExport(jobData, workerToken);
        break;
      default:
        throw new Error(`未知的任务类型: ${jobData.type}`);
    }
  } catch (error) {
    console.error(`处理任务 ${jobData.id} 失败:`, error);
    await failJob(
      {
        jobId: jobData.id,
        errorMessage: error instanceof Error ? error.message : "处理任务失败",
      },
      workerToken
    );
  }
}

/**
 * 处理批量图像生成任务
 * TODO: 实现批量图像生成逻辑
 */
async function processBatchImageGeneration(jobData: Job, workerToken: string): Promise<void> {
  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 10,
      progressMessage: "功能开发中...",
    },
    workerToken
  );

  await completeJob(
    {
      jobId: jobData.id,
      resultData: { message: "功能开发中" },
    },
    workerToken
  );
}

