/**
 * 视频生成服务抽象层
 *
 * 提供统一的接口，支持多个视频生成服务提供商：
 * - Seedance 1.5 Pro (kie.ai) - 默认提供商，字节跳动的视频生成模型
 * - Veo 3.1 (kie.ai) - 备用提供商，Google 的视频生成模型
 * - Kling (fal.ai) - 备用提供商
 *
 * 通过环境变量 VIDEO_SERVICE_PROVIDER 配置：
 * - "seedance" (默认) - 使用 Seedance 1.5 Pro 模型
 * - "veo" - 使用 Veo 3.1 模型
 * - "kling" - 使用 Kling O1 模型
 */

import type { VideoGenerationConfig } from "@/types/asset";

// ============= 服务提供商类型 =============

export type VideoServiceProvider = "seedance" | "veo" | "kling";

/**
 * 统一的视频输出接口
 */
export interface VideoServiceOutput {
  videoUrl: string;
  duration?: number;
  thumbnailUrl?: string;
}

// ============= 配置函数 =============

/**
 * 获取当前配置的视频服务提供商
 */
export function getVideoServiceProvider(): VideoServiceProvider {
  const provider = process.env.VIDEO_SERVICE_PROVIDER?.toLowerCase();

  if (provider === "veo") {
    return "veo";
  }
  if (provider === "kling") {
    return "kling";
  }

  // 默认使用 Seedance 1.5 Pro
  return "seedance";
}

// ============= Seedance 1.5 Pro 服务适配器 =============

async function generateVideoWithSeedance(
  config: VideoGenerationConfig
): Promise<VideoServiceOutput> {
  const {
    generateSeedanceVideo,
    waitForSeedanceVideo,
  } = await import("@/lib/services/kie");

  const duration = config.duration || "4";
  console.log(`[VideoService] 使用 Seedance 1.5 Pro 生成视频 (${duration}s)`);

  // 收集图片URL（起始帧和结束帧）
  const imageUrls: string[] = [config.start_image_url];
  if (config.end_image_url) {
    imageUrls.push(config.end_image_url);
  }

  const taskResult = await generateSeedanceVideo({
    prompt: config.prompt,
    imageUrls,
    duration,
    aspectRatio: config.aspect_ratio || "16:9",
    resolution: "720p",
    generateAudio: false,
  });

  console.log(`[VideoService] Seedance 任务创建成功: ${taskResult.taskId}`);
  console.log(`[VideoService] 开始轮询等待视频生成...`);

  const result = await waitForSeedanceVideo(taskResult.taskId);

  if (!result.videoUrl) {
    throw new Error("Seedance 视频生成失败：未返回视频URL");
  }

  return {
    videoUrl: result.videoUrl,
    duration: parseInt(duration),
  };
}

// ============= Kling 服务适配器 =============

async function generateVideoWithKling(
  config: VideoGenerationConfig
): Promise<VideoServiceOutput> {
  const {
    generateKlingO1ImageToVideo,
  } = await import("@/lib/services/fal");

  console.log(`[VideoService] 使用 Kling 首尾帧生成视频`);

  const videoResult = await generateKlingO1ImageToVideo({
    prompt: config.prompt,
    start_image_url: config.start_image_url,
    end_image_url: config.end_image_url,
    negative_prompt: config.negative_prompt,
  });

  if (!videoResult.video?.url) {
    throw new Error("Kling 视频生成失败：未返回视频URL");
  }

  return {
    videoUrl: videoResult.video.url,
  };
}

// ============= Veo 3.1 服务适配器 =============

async function generateVideoWithVeo(
  config: VideoGenerationConfig
): Promise<VideoServiceOutput> {
  const {
    generateVeo3Video,
    waitForVeo3Video,
  } = await import("@/lib/services/kie");

  console.log(`[VideoService] 使用 Veo 3.1 首尾帧生成视频`);

  const imageUrls: string[] = [config.start_image_url];
  if (config.end_image_url) {
    imageUrls.push(config.end_image_url);
  }

  const taskResult = await generateVeo3Video({
    prompt: config.prompt,
    imageUrls,
    generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
    aspectRatio: config.aspect_ratio === "9:16" ? "9:16" : config.aspect_ratio === "16:9" ? "16:9" : "Auto",
    model: "veo3_fast",
    enableTranslation: true,
  });

  console.log(`[VideoService] Veo 3.1 任务创建成功: ${taskResult.taskId}`);
  console.log(`[VideoService] 开始轮询等待视频生成...`);

  const result = await waitForVeo3Video(taskResult.taskId);

  if (!result.videoUrl) {
    throw new Error("Veo 3.1 视频生成失败：未返回视频URL");
  }

  return {
    videoUrl: result.videoUrl,
  };
}

// ============= 统一接口 =============

/**
 * 生成视频（统一接口）
 *
 * 根据环境变量自动选择服务提供商：
 * - VIDEO_SERVICE_PROVIDER=seedance (默认) → 使用 Seedance 1.5 Pro
 * - VIDEO_SERVICE_PROVIDER=veo → 使用 Veo 3.1
 * - VIDEO_SERVICE_PROVIDER=kling → 使用 Kling O1
 *
 * @param config 视频生成配置
 * @returns 视频URL和元数据
 */
export async function generateVideo(
  config: VideoGenerationConfig
): Promise<VideoServiceOutput> {
  const provider = getVideoServiceProvider();

  console.log(`[VideoService] 当前视频服务提供商: ${provider}`);

  try {
    switch (provider) {
      case "seedance":
        return await generateVideoWithSeedance(config);

      case "veo":
        return await generateVideoWithVeo(config);

      case "kling":
        return await generateVideoWithKling(config);

      default:
        return await generateVideoWithSeedance(config);
    }
  } catch (error) {
    console.error(`[VideoService] ${provider} 视频生成失败:`, error);
    throw error;
  }
}
