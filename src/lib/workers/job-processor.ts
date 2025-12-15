"use server";

import { getWorkerToken } from "@/lib/workers/auth";
import type { Job } from "@/types/job";
import { registry } from "./processor-registry";

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
import { processShotDecomposition } from "./processors/shot-decomposition";
import {
  processShotImageGeneration,
  processBatchShotImageGeneration,
} from "./processors/shot-image-generation";
import {
  processVideoGeneration,
  processShotVideoGeneration,
  processBatchVideoGeneration,
  processFinalVideoExport,
} from "./processors/video-processors";

/**
 * 注册所有处理器
 * 在Worker启动时调用一次
 */
export function registerAllProcessors(): void {
  registry.registerAll({
    character_extraction: processCharacterExtraction,
    scene_extraction: processSceneExtraction,
    character_image_generation: processCharacterImageGeneration,
    scene_image_generation: processSceneImageGeneration,
    storyboard_generation: processStoryboardGeneration,
    storyboard_basic_extraction: processStoryboardBasicExtraction,
    storyboard_matching: processStoryboardMatching,
    shot_decomposition: processShotDecomposition,
    shot_image_generation: processShotImageGeneration,
    batch_shot_image_generation: processBatchShotImageGeneration,
    video_generation: processVideoGeneration,
    shot_video_generation: processShotVideoGeneration,
    batch_video_generation: processBatchVideoGeneration,
    final_video_export: processFinalVideoExport,
  });

  console.log(
    `[ProcessorRegistry] 已注册 ${registry.getRegisteredTypes().length} 个处理器:`,
    registry.getRegisteredTypes().join(", ")
  );
}

/**
 * 处理单个任务
 * 使用注册表查找并执行对应的处理器
 */
export async function processJob(jobData: Job): Promise<void> {
  const workerToken = getWorkerToken();
  
  try {
    await registry.process(jobData, workerToken);
  } catch (error) {
    console.error(`处理任务 ${jobData.id} 失败:`, error);
    // 错误处理已经在BaseProcessor或processor内部完成
    // 这里只是记录日志，避免重复failJob
    if (error instanceof Error && error.message.includes("未知的任务类型")) {
      // 只有未知类型才需要在这里处理
      const { failJob } = await import("@/lib/actions/job");
      await failJob(
        {
          jobId: jobData.id,
          errorMessage: error.message,
        },
        workerToken
      );
    }
  }
}
