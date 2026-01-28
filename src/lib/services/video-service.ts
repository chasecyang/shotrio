/**
 * 视频生成服务
 *
 * 使用 Veo 3.1 (kie.ai) 生成视频
 * - REFERENCE_2_VIDEO 模式：支持 1-3 张参考图
 * - 固定 8 秒时长
 * - 支持 16:9 和 9:16 比例
 */

import type { VideoGenerationConfig } from "@/types/asset";

/**
 * 统一的视频输出接口
 */
export interface VideoServiceOutput {
  videoUrl: string;
  duration?: number;
  thumbnailUrl?: string;
}

/**
 * 生成视频（使用 Veo 3.1）
 *
 * @param config 视频生成配置
 * @returns 视频URL和元数据
 */
export async function generateVideo(
  config: VideoGenerationConfig
): Promise<VideoServiceOutput> {
  const {
    generateVeo3Video,
    waitForVeo3Video,
  } = await import("@/lib/services/kie");

  console.log(`[VideoService] 使用 Veo 3.1 (kie.ai) 参考图生成视频`);

  if (!config.reference_image_urls || config.reference_image_urls.length === 0) {
    throw new Error("Veo 3.1 需要至少一张参考图");
  }

  // Veo 3.1 支持最多 3 张参考图
  let imageUrls = config.reference_image_urls;

  // 限制最多 3 张参考图
  if (imageUrls.length > 3) {
    console.warn(`[VideoService] Veo 3.1 最多支持 3 张参考图，当前有 ${imageUrls.length} 张，将只使用前 3 张`);
    imageUrls = imageUrls.slice(0, 3);
  }

  // REFERENCE_2_VIDEO: 支持 1-3 张参考图（仅支持 veo3_fast 和 16:9/9:16）
  const generationType = "REFERENCE_2_VIDEO";

  // REFERENCE_2_VIDEO 模式只支持 16:9 和 9:16，不支持 Auto
  const aspectRatio = config.aspect_ratio === "9:16" ? "9:16" : "16:9";

  console.log(`[VideoService] 使用 ${imageUrls.length} 张参考图，生成类型: ${generationType}`);

  const taskResult = await generateVeo3Video({
    prompt: config.prompt,
    imageUrls,
    generationType,
    aspectRatio,
    model: "veo3_fast",
    enableTranslation: true,
  });

  console.log(`[VideoService] Veo 3.1 (kie.ai) 任务创建成功: ${taskResult.taskId}`);
  console.log(`[VideoService] 开始轮询等待视频生成...`);

  const result = await waitForVeo3Video(taskResult.taskId);

  if (!result.videoUrl) {
    throw new Error("Veo 3.1 (kie.ai) 视频生成失败：未返回视频URL");
  }

  return {
    videoUrl: result.videoUrl,
    duration: 8, // Veo 3.1 固定 8 秒
  };
}
