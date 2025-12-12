import { fal } from "@fal-ai/client";
import { getImageUrl } from "@/lib/storage/r2.service";

// 配置 fal 客户端
export function configureFal() {
  const falKey = process.env.FAL_KEY;
  
  if (!falKey) {
    throw new Error("FAL_KEY is not configured");
  }

  fal.config({
    credentials: falKey,
  });
}

// ============= Nano Banana Pro 类型定义 =============

export type AspectRatio = 
  | "21:9" | "16:9" | "3:2" | "4:3" | "5:4" 
  | "1:1" 
  | "4:5" | "3:4" | "2:3" | "9:16";

export type OutputFormat = "jpeg" | "png" | "webp";

export type Resolution = "1K" | "2K" | "4K";

export interface GeneratedImage {
  url: string;
  content_type?: string;
  file_name?: string;
  file_size?: number;
  width?: number;
  height?: number;
  file_data?: string;
}

export interface GenerateImageOutput {
  images: GeneratedImage[];
  description: string;
}

// 文生图输入参数
export interface TextToImageInput {
  prompt: string;
  num_images?: number;
  aspect_ratio?: AspectRatio;
  output_format?: OutputFormat;
  resolution?: Resolution;
  sync_mode?: boolean;
  limit_generations?: boolean;
  enable_web_search?: boolean;
}

// 图生图/编辑输入参数
export interface ImageToImageInput {
  prompt: string;
  image_urls: string[];  // 可以提供多张参考图（最多14张）
  num_images?: number;
  aspect_ratio?: AspectRatio | "auto";
  output_format?: OutputFormat;
  resolution?: Resolution;
  sync_mode?: boolean;
  limit_generations?: boolean;
  enable_web_search?: boolean;
}

// 兼容旧版接口的类型别名
export interface GenerateImageInput {
  prompt: string;
  num_images?: number;
  output_format?: OutputFormat;
  aspect_ratio?: AspectRatio;
}

// ============= Nano Banana Pro 文生图接口 =============

/**
 * 使用 Nano Banana Pro 模型生成图像（文生图）
 * 基于 Google Gemini 3 Pro Image 架构
 * 成本：约 $0.15/张，4K 双倍价格
 */
export async function generateImagePro(
  input: TextToImageInput
): Promise<GenerateImageOutput> {
  configureFal();

  const result = await fal.subscribe("fal-ai/nano-banana-pro", {
    input: {
      prompt: input.prompt,
      num_images: input.num_images ?? 1,
      aspect_ratio: input.aspect_ratio ?? "1:1",
      output_format: input.output_format ?? "png",
      resolution: input.resolution ?? "1K",
      sync_mode: input.sync_mode ?? false,
      limit_generations: input.limit_generations,
      enable_web_search: input.enable_web_search,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log) => log.message).forEach(console.log);
      }
    },
  });

  return result.data as GenerateImageOutput;
}

/**
 * 使用 Nano Banana Pro 模型编辑/转换图像（图生图）
 * 支持多图输入（最多14张）和角色一致性（最多5人）
 * 成本：约 $0.15/张，4K 双倍价格
 */
export async function editImagePro(
  input: ImageToImageInput
): Promise<GenerateImageOutput> {
  configureFal();

  // 处理图片 URL：如果是 R2 key，转换为公开 URL
  const processedUrls = await Promise.all(
    input.image_urls.map(async (url) => {
      if (!url.startsWith("http")) {
        const publicUrl = getImageUrl(url);
        return publicUrl || url;
      }
      return url;
    })
  );

  const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
    input: {
      prompt: input.prompt,
      image_urls: processedUrls,
      num_images: input.num_images ?? 1,
      aspect_ratio: input.aspect_ratio ?? "auto",
      output_format: input.output_format ?? "png",
      resolution: input.resolution ?? "1K",
      sync_mode: input.sync_mode ?? false,
      limit_generations: input.limit_generations,
      enable_web_search: input.enable_web_search,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log) => log.message).forEach(console.log);
      }
    },
  });

  return result.data as GenerateImageOutput;
}

// ============= 旧版 Nano Banana 接口（保持向后兼容）=============

/**
 * 使用旧版 nano-banana 模型生成图像
 * @deprecated 建议使用 generateImagePro 以获得更好的质量
 */
export async function generateImage(
  input: GenerateImageInput
): Promise<GenerateImageOutput> {
  configureFal();

  const result = await fal.subscribe("fal-ai/nano-banana", {
    input: {
      prompt: input.prompt,
      num_images: input.num_images ?? 1,
      output_format: input.output_format ?? "jpeg",
      aspect_ratio: input.aspect_ratio ?? "1:1",
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log) => log.message).forEach(console.log);
      }
    },
  });

  return result.data as GenerateImageOutput;
}

// ============= Nano Banana Pro 队列接口 =============

/**
 * 使用队列方式提交文生图请求（适用于批量生成）
 */
export async function queueTextToImagePro(
  input: TextToImageInput,
  webhookUrl?: string
): Promise<{ request_id: string }> {
  configureFal();

  const { request_id } = await fal.queue.submit("fal-ai/nano-banana-pro", {
    input: {
      prompt: input.prompt,
      num_images: input.num_images ?? 1,
      aspect_ratio: input.aspect_ratio ?? "1:1",
      output_format: input.output_format ?? "png",
      resolution: input.resolution ?? "1K",
      sync_mode: input.sync_mode ?? false,
      limit_generations: input.limit_generations,
      enable_web_search: input.enable_web_search,
    },
    webhookUrl,
  });

  return { request_id };
}

/**
 * 使用队列方式提交图生图请求（适用于批量编辑）
 */
export async function queueImageToImagePro(
  input: ImageToImageInput,
  webhookUrl?: string
): Promise<{ request_id: string }> {
  configureFal();

  // 处理图片 URL
  const processedUrls = await Promise.all(
    input.image_urls.map(async (url) => {
      if (!url.startsWith("http")) {
        const publicUrl = getImageUrl(url);
        return publicUrl || url;
      }
      return url;
    })
  );

  const { request_id } = await fal.queue.submit("fal-ai/nano-banana-pro/edit", {
    input: {
      prompt: input.prompt,
      image_urls: processedUrls,
      num_images: input.num_images ?? 1,
      aspect_ratio: input.aspect_ratio ?? "auto",
      output_format: input.output_format ?? "png",
      resolution: input.resolution ?? "1K",
      sync_mode: input.sync_mode ?? false,
      limit_generations: input.limit_generations,
      enable_web_search: input.enable_web_search,
    },
    webhookUrl,
  });

  return { request_id };
}

/**
 * 获取队列中的请求状态
 */
export async function getQueueStatusPro(
  requestId: string,
  modelType: "text-to-image" | "image-to-image" = "text-to-image"
) {
  configureFal();

  const modelId = modelType === "image-to-image" 
    ? "fal-ai/nano-banana-pro/edit" 
    : "fal-ai/nano-banana-pro";

  return await fal.queue.status(modelId, {
    requestId,
    logs: true,
  });
}

/**
 * 获取队列中的请求结果
 */
export async function getQueueResultPro(
  requestId: string,
  modelType: "text-to-image" | "image-to-image" = "text-to-image"
): Promise<GenerateImageOutput> {
  configureFal();

  const modelId = modelType === "image-to-image" 
    ? "fal-ai/nano-banana-pro/edit" 
    : "fal-ai/nano-banana-pro";

  const result = await fal.queue.result(modelId, {
    requestId,
  });

  return result.data as GenerateImageOutput;
}

// ============= 旧版队列接口（保持向后兼容）=============

/**
 * 使用队列方式提交图像生成请求（旧版）
 * @deprecated 建议使用 queueTextToImagePro
 */
export async function queueImageGeneration(
  input: GenerateImageInput,
  webhookUrl?: string
): Promise<{ request_id: string }> {
  configureFal();

  const { request_id } = await fal.queue.submit("fal-ai/nano-banana", {
    input: {
      prompt: input.prompt,
      num_images: input.num_images ?? 1,
      output_format: input.output_format ?? "jpeg",
      aspect_ratio: input.aspect_ratio ?? "1:1",
    },
    webhookUrl,
  });

  return { request_id };
}

/**
 * 获取队列中的请求状态（旧版）
 * @deprecated 建议使用 getQueueStatusPro
 */
export async function getQueueStatus(requestId: string) {
  configureFal();

  return await fal.queue.status("fal-ai/nano-banana", {
    requestId,
    logs: true,
  });
}

/**
 * 获取队列中的请求结果（旧版）
 * @deprecated 建议使用 getQueueResultPro
 */
export async function getQueueResult(
  requestId: string
): Promise<GenerateImageOutput> {
  configureFal();

  const result = await fal.queue.result("fal-ai/nano-banana", {
    requestId,
  });

  return result.data as GenerateImageOutput;
}

// ============= Kling Video 类型定义 =============

export type VideoDuration = "5" | "10";
export type VideoAspectRatio = "16:9" | "9:16" | "1:1";

export interface VideoFile {
  url: string;
  content_type?: string;
  file_name?: string;
  file_size?: number;
}

export interface ImageToVideoInput {
  prompt: string;
  image_url: string;
  duration?: VideoDuration;
  negative_prompt?: string;
  generate_audio?: boolean;
}

export interface ImageToVideoOutput {
  video: VideoFile;
}

// ============= Kling Image to Video 接口 =============

/**
 * 使用 Kling V2.6 Pro 将图像转换为视频
 * 特性：
 * - 电影级视觉质量和流畅运动
 * - 支持原生音频生成（中英文）
 * - 视频时长：5 或 10 秒
 * 
 * 参考: https://fal.ai/models/fal-ai/kling-video/v2.6/pro/image-to-video/api
 */
export async function generateImageToVideo(
  input: ImageToVideoInput
): Promise<ImageToVideoOutput> {
  configureFal();

  // 处理图片 URL：如果是 R2 key，转换为公开 URL
  let imageUrl = input.image_url;
  if (!imageUrl.startsWith("http")) {
    const publicUrl = getImageUrl(imageUrl);
    imageUrl = publicUrl || imageUrl;
  }

  const result = await fal.subscribe("fal-ai/kling-video/v2.6/pro/image-to-video", {
    input: {
      prompt: input.prompt,
      image_url: imageUrl,
      duration: input.duration ?? "5",
      negative_prompt: input.negative_prompt ?? "blur, distort, and low quality",
      generate_audio: input.generate_audio ?? true,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log) => log.message).forEach(console.log);
      }
    },
  });

  return result.data as ImageToVideoOutput;
}

/**
 * 使用队列方式提交图像转视频请求（适用于长时间生成）
 */
export async function queueImageToVideo(
  input: ImageToVideoInput,
  webhookUrl?: string
): Promise<{ request_id: string }> {
  configureFal();

  // 处理图片 URL
  let imageUrl = input.image_url;
  if (!imageUrl.startsWith("http")) {
    const publicUrl = getImageUrl(imageUrl);
    imageUrl = publicUrl || imageUrl;
  }

  const { request_id } = await fal.queue.submit(
    "fal-ai/kling-video/v2.6/pro/image-to-video",
    {
      input: {
        prompt: input.prompt,
        image_url: imageUrl,
        duration: input.duration ?? "5",
        negative_prompt: input.negative_prompt ?? "blur, distort, and low quality",
        generate_audio: input.generate_audio ?? true,
      },
      webhookUrl,
    }
  );

  return { request_id };
}

/**
 * 获取图像转视频队列请求状态
 */
export async function getImageToVideoStatus(requestId: string) {
  configureFal();

  return await fal.queue.status("fal-ai/kling-video/v2.6/pro/image-to-video", {
    requestId,
    logs: true,
  });
}

/**
 * 获取图像转视频队列请求结果
 */
export async function getImageToVideoResult(
  requestId: string
): Promise<ImageToVideoOutput> {
  configureFal();

  const result = await fal.queue.result("fal-ai/kling-video/v2.6/pro/image-to-video", {
    requestId,
  });

  return result.data as ImageToVideoOutput;
}

// ============= Vision 接口 =============

export interface VisionInput {
  imageUrl: string;
  prompt?: string;
}

export interface VisionOutput {
  choices?: Array<{
    message: {
      content: string;
    };
  }>;
  message?: string;
  text?: string;
  output?: string;
}

/**
 * Use Vision model to analyze images
 */
export async function generateVisionDescription(
  input: VisionInput
): Promise<string> {
  configureFal();

  const prompt = input.prompt || "Describe this image in detail, focusing on the visual elements, characters, and action.";

  // 如果是 R2 key，获取公开 URL
  // 注意：如果是在 Server Action 只有 key，需要转换成可访问的 URL 给 Vision API
  let imageUrl = input.imageUrl;
  
  // 简单的判断是否为 URL
  if (!imageUrl.startsWith("http")) {
     const publicUrl = getImageUrl(imageUrl);
     if (publicUrl) {
       imageUrl = publicUrl;
     }
  }

  try {
    // Use openrouter/router/vision for vision analysis
    // Input format: { image_urls: string[], prompt: string, model: string }
    const result = await fal.subscribe("openrouter/router/vision", {
      input: {
        image_urls: [imageUrl],
        prompt: prompt,
        model: "openai/gpt-4o-mini"
      },
      logs: true,
    });

    const data = result.data as VisionOutput;
    
    if ('output' in data && typeof data.output === 'string') {
      return data.output;
    }
    
    if (data.choices && data.choices.length > 0 && data.choices[0].message?.content) {
      return data.choices[0].message.content;
    }
    
    if (data.message) return data.message;
    if (data.text) return data.text;
    
    console.error("Unexpected vision model response:", data);
    return "Failed to analyze image: Unexpected response format";
  } catch (error) {
    console.error("Vision API error:", error);
    throw new Error("Failed to analyze image");
  }
}

