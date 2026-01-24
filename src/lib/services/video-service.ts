/**
 * 视频生成服务抽象层
 *
 * 提供统一的接口，支持多个视频生成服务提供商：
 * - Sora2 - OpenAI 的视频生成模型（标准版）
 *   - yunwu.ai 平台（默认）
 * - Sora2 Pro - OpenAI 的视频生成模型（专业版）
 *   - yunwu.ai 平台（默认）
 *   - kie.ai 平台（通过 SORA2_PLATFORM=kie 配置）
 * - Seedance 1.5 Pro - 字节跳动的视频生成模型
 *   - kie.ai 平台（默认）
 * - Veo 3.1 - Google 的视频生成模型
 *   - kie.ai 平台（默认）
 *   - yunwu.ai 平台（通过 VEO_PLATFORM=yunwu 配置）
 * - Kling - 快手的视频生成模型
 *   - fal.ai 平台（默认）
 *
 * 通过环境变量配置：
 * - VIDEO_SERVICE_PROVIDER: 选择使用的模型（sora2/sora2pro/seedance/veo/kling）
 * - SORA2_PLATFORM: Sora2 模型的平台（kie/yunwu，默认 yunwu）
 * - VEO_PLATFORM: Veo 模型的平台（kie/yunwu，默认 kie）
 * - SEEDANCE_PLATFORM: Seedance 模型的平台（kie，默认 kie）
 * - KLING_PLATFORM: Kling 模型的平台（fal，默认 fal）
 */

import type { VideoGenerationConfig } from "@/types/asset";

// ============= 服务提供商类型 =============

export type VideoServiceProvider = "sora2" | "sora2pro" | "seedance" | "veo" | "kling";

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

  if (provider === "sora2") {
    return "sora2";
  }
  if (provider === "sora2pro") {
    return "sora2pro";
  }
  if (provider === "seedance") {
    return "seedance";
  }
  if (provider === "veo") {
    return "veo";
  }
  if (provider === "kling") {
    return "kling";
  }

  // 默认使用 Veo 3.1
  return "veo";
}

// ============= Sora2 标准版服务适配器 =============

async function generateVideoWithSora2(
  config: VideoGenerationConfig
): Promise<VideoServiceOutput> {
  // Sora2 标准版目前仅支持 yunwu.ai 平台
  return await generateVideoWithSora2Yunwu(config);
}

/**
 * 使用 yunwu.ai 平台的 Sora2 标准版
 */
async function generateVideoWithSora2Yunwu(
  config: VideoGenerationConfig
): Promise<VideoServiceOutput> {
  const {
    generateYunwuSora2StandardVideo,
  } = await import("@/lib/services/yunwu");

  // Sora2 标准版支持 10 或 15 秒
  const duration = config.duration === "15" ? 15 : 10;
  console.log(`[VideoService] 使用 Sora2 (yunwu.ai) 生成视频 (${duration}s)`);

  const result = await generateYunwuSora2StandardVideo({
    prompt: config.prompt,
    imageUrls: config.reference_image_urls,
    duration,
    orientation: config.aspect_ratio === "9:16" ? "portrait" : "landscape",
    watermark: false,
    private: true,
  });

  if (!result.videoUrl) {
    throw new Error("Sora2 (yunwu.ai) 视频生成失败：未返回视频URL");
  }

  return {
    videoUrl: result.videoUrl,
    duration,
  };
}

// ============= Sora2 Pro 服务适配器 =============

async function generateVideoWithSora2Pro(
  config: VideoGenerationConfig
): Promise<VideoServiceOutput> {
  // 检查使用哪个平台
  const platform = process.env.SORA2_PLATFORM?.toLowerCase() || "yunwu";

  if (platform === "kie") {
    return await generateVideoWithSora2ProKie(config);
  }

  // 默认使用 yunwu 平台
  return await generateVideoWithSora2ProYunwu(config);
}

/**
 * 使用 kie.ai 平台的 Sora2 Pro
 */
async function generateVideoWithSora2ProKie(
  config: VideoGenerationConfig
): Promise<VideoServiceOutput> {
  const {
    generateSora2Video,
    waitForSora2Video,
  } = await import("@/lib/services/kie");

  const duration = config.duration === "15" ? "15" : "10";
  console.log(`[VideoService] 使用 Sora2 Pro (kie.ai) 生成视频 (${duration}s)`);

  // 选择模型：使用图生视频
  const model = "sora-2-pro-image-to-video";

  const taskResult = await generateSora2Video({
    model,
    prompt: config.prompt,
    imageUrls: config.reference_image_urls,
    duration,
    aspectRatio: config.aspect_ratio === "9:16" ? "portrait" : "landscape",
    size: "high",
    removeWatermark: true,
  });

  console.log(`[VideoService] Sora2 Pro (kie.ai) 任务创建成功: ${taskResult.taskId}`);
  console.log(`[VideoService] 开始轮询等待视频生成...`);

  // Sora2 生成时间可能较长，设置 30 分钟超时（180 次 × 10 秒）
  const result = await waitForSora2Video(taskResult.taskId, 180);

  if (!result.videoUrl) {
    throw new Error("Sora2 Pro (kie.ai) 视频生成失败：未返回视频URL");
  }

  return {
    videoUrl: result.videoUrl,
    duration: parseInt(duration),
  };
}

/**
 * 使用 yunwu.ai 平台的 Sora2 Pro
 */
async function generateVideoWithSora2ProYunwu(
  config: VideoGenerationConfig
): Promise<VideoServiceOutput> {
  const {
    generateYunwuSora2Video,
  } = await import("@/lib/services/yunwu");

  // 云雾支持 15 或 25 秒，将 10 秒映射到 15 秒
  const duration = config.duration === "15" ? 15 : 15;
  console.log(`[VideoService] 使用 Sora2 Pro (yunwu.ai) 生成视频 (${duration}s)`);

  const result = await generateYunwuSora2Video({
    prompt: config.prompt,
    imageUrls: config.reference_image_urls,
    duration,
    orientation: config.aspect_ratio === "9:16" ? "portrait" : "landscape",
    watermark: false,
    private: true,
  });

  if (!result.videoUrl) {
    throw new Error("Sora2 Pro (yunwu.ai) 视频生成失败：未返回视频URL");
  }

  return {
    videoUrl: result.videoUrl,
    duration,
  };
}

// ============= Seedance 1.5 Pro 服务适配器 =============

async function generateVideoWithSeedance(
  config: VideoGenerationConfig
): Promise<VideoServiceOutput> {
  const {
    generateSeedanceVideo,
    waitForSeedanceVideo,
  } = await import("@/lib/services/kie");

  // 将新的 duration 映射到 Seedance 支持的值
  let duration: "4" | "8" | "12";
  if (config.duration === "15") {
    duration = "12"; // 15s 映射到 12s
  } else {
    duration = "8"; // 10s 或默认映射到 8s
  }

  console.log(`[VideoService] 使用 Seedance 1.5 Pro 生成视频 (${duration}s)`);

  const taskResult = await generateSeedanceVideo({
    prompt: config.prompt,
    imageUrls: config.reference_image_urls,
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

  console.log(`[VideoService] 使用 Kling 参考图生成视频`);

  const start_image_url = config.reference_image_urls[0];
  const end_image_url = config.reference_image_urls[1];

  if (!start_image_url) {
    throw new Error("Kling 需要至少一张参考图");
  }

  const videoResult = await generateKlingO1ImageToVideo({
    prompt: config.prompt,
    start_image_url,
    end_image_url,
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
  // 检查使用哪个平台
  const platform = process.env.VEO_PLATFORM?.toLowerCase() || "kie";

  if (platform === "yunwu") {
    return await generateVideoWithVeoYunwu(config);
  }

  // 默认使用 kie 平台
  return await generateVideoWithVeoKie(config);
}

/**
 * 使用 kie.ai 平台的 Veo 3.1
 */
async function generateVideoWithVeoKie(
  config: VideoGenerationConfig
): Promise<VideoServiceOutput> {
  const {
    generateVeo3Video,
    waitForVeo3Video,
  } = await import("@/lib/services/kie");

  console.log(`[VideoService] 使用 Veo 3.1 (kie.ai) 参考图生成视频`);

  // Veo 3.1 支持最多 3 张参考图
  let imageUrls = config.reference_image_urls;

  // 限制最多 3 张参考图
  if (imageUrls.length > 3) {
    console.warn(`[VideoService] Veo 3.1 最多支持 3 张参考图，当前有 ${imageUrls.length} 张，将只使用前 3 张`);
    imageUrls = imageUrls.slice(0, 3);
  }

  // 始终使用参考图生成模式
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
  };
}

/**
 * 使用 yunwu.ai 平台的 Veo 3.1
 */
async function generateVideoWithVeoYunwu(
  config: VideoGenerationConfig
): Promise<VideoServiceOutput> {
  const {
    generateYunwuVeo3Video,
  } = await import("@/lib/services/yunwu");

  console.log(`[VideoService] 使用 Veo 3.1 (yunwu.ai) 生成视频`);

  // Veo 3.1 支持最多 3 张参考图
  let imageUrls = config.reference_image_urls;

  // 限制最多 3 张参考图
  if (imageUrls.length > 3) {
    console.warn(`[VideoService] Veo 3.1 最多支持 3 张参考图，当前有 ${imageUrls.length} 张，将只使用前 3 张`);
    imageUrls = imageUrls.slice(0, 3);
  }

  console.log(`[VideoService] 使用 ${imageUrls.length} 张参考图生成视频`);

  const result = await generateYunwuVeo3Video({
    prompt: config.prompt,
    imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    aspectRatio: config.aspect_ratio === "9:16" ? "9:16" : config.aspect_ratio === "16:9" ? "16:9" : undefined,
    enhancePrompt: true,
    enableUpsample: true,
  });

  if (!result.videoUrl) {
    throw new Error("Veo 3.1 (yunwu.ai) 视频生成失败：未返回视频URL");
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
 * - VIDEO_SERVICE_PROVIDER=sora2 → 使用 Sora2 标准版
 * - VIDEO_SERVICE_PROVIDER=veo (默认) → 使用 Veo 3.1
 * - VIDEO_SERVICE_PROVIDER=seedance → 使用 Seedance 1.5 Pro
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
      case "sora2":
        return await generateVideoWithSora2(config);

      case "sora2pro":
        return await generateVideoWithSora2Pro(config);

      case "seedance":
        return await generateVideoWithSeedance(config);

      case "veo":
        return await generateVideoWithVeo(config);

      case "kling":
        return await generateVideoWithKling(config);

      default:
        return await generateVideoWithSora2Pro(config);
    }
  } catch (error) {
    console.error(`[VideoService] ${provider} 视频生成失败:`, error);
    throw error;
  }
}
