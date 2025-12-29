"use server";

import { getWorkerToken } from "@/lib/workers/auth";
import type { Job } from "@/types/job";
import { registry } from "./processor-registry";

// 导入各个处理器
import {
  processVideoGeneration,
  processShotVideoGeneration,
  processFinalVideoExport,
} from "./processors/video-processors";
import { processAssetImageGeneration } from "./processors/asset-image-generation";

/**
 * 注册所有处理器
 * 在Worker启动时调用一次
 */
export function registerAllProcessors(): void {
  registry.registerAll({
    asset_image_generation: processAssetImageGeneration,
    video_generation: processVideoGeneration,
    shot_video_generation: processShotVideoGeneration,
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
    // 错误处理统一在 standalone-worker.ts 的 processJobAsync 中完成
    // 这里只处理特殊情况：未知的任务类型（这种情况任务还没有被 startJob）
    if (error instanceof Error && error.message.includes("未知的任务类型")) {
      // 未知类型的任务还没有被标记为 processing，需要在这里处理
      const { failJob } = await import("@/lib/actions/job");
      await failJob(
        {
          jobId: jobData.id,
          errorMessage: error.message,
        },
        workerToken
      );
      // 不重新抛出，避免在 standalone-worker 中重复调用 failJob
      return;
    }
    // 其他错误重新抛出，由 standalone-worker 统一处理
    throw error;
  }
}
