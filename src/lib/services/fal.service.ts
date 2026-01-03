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

// ============= Nano Banana 类型定义 =============

export type AspectRatio = 
  | "21:9" | "16:9" | "3:2" | "4:3" | "5:4" 
  | "1:1" 
  | "4:5" | "3:4" | "2:3" | "9:16";

export type OutputFormat = "jpeg" | "png" | "webp";

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
  sync_mode?: boolean;
}

// 图生图/编辑输入参数
export interface ImageToImageInput {
  prompt: string;
  image_urls: string[];  // 可以提供多张参考图（最多14张）
  num_images?: number;
  aspect_ratio?: AspectRatio;
  output_format?: OutputFormat;
  sync_mode?: boolean;
}

// ============= Nano Banana 文生图接口 =============

/**
 * 使用 Nano Banana 模型生成图像（文生图）
 */
export async function generateImage(
  input: TextToImageInput
): Promise<GenerateImageOutput> {
  configureFal();

  const result = await fal.subscribe("fal-ai/nano-banana", {
    input: {
      prompt: input.prompt,
      num_images: input.num_images ?? 1,
      aspect_ratio: input.aspect_ratio ?? "1:1",
      output_format: input.output_format ?? "png",
      sync_mode: input.sync_mode ?? false,
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
 * 使用 Nano Banana 模型编辑/转换图像（图生图）
 * 支持多图输入（最多14张）和角色一致性（最多5人）
 */
export async function editImage(
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

  const result = await fal.subscribe("fal-ai/nano-banana/edit", {
    input: {
      prompt: input.prompt,
      image_urls: processedUrls,
      num_images: input.num_images ?? 1,
      aspect_ratio: input.aspect_ratio ?? "16:9",
      output_format: input.output_format ?? "png",
      sync_mode: input.sync_mode ?? false,
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

// ============= Nano Banana 队列接口 =============

/**
 * 使用队列方式提交文生图请求（适用于批量生成）
 */
export async function queueTextToImage(
  input: TextToImageInput,
  webhookUrl?: string
): Promise<{ request_id: string }> {
  configureFal();

  const { request_id } = await fal.queue.submit("fal-ai/nano-banana", {
    input: {
      prompt: input.prompt,
      num_images: input.num_images ?? 1,
      aspect_ratio: input.aspect_ratio ?? "1:1",
      output_format: input.output_format ?? "png",
      sync_mode: input.sync_mode ?? false,
    },
    webhookUrl,
  });

  return { request_id };
}

/**
 * 使用队列方式提交图生图请求（适用于批量编辑）
 */
export async function queueImageToImage(
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

  const { request_id } = await fal.queue.submit("fal-ai/nano-banana/edit", {
    input: {
      prompt: input.prompt,
      image_urls: processedUrls,
      num_images: input.num_images ?? 1,
      aspect_ratio: input.aspect_ratio ?? "16:9",
      output_format: input.output_format ?? "png",
      sync_mode: input.sync_mode ?? false,
    },
    webhookUrl,
  });

  return { request_id };
}

/**
 * 获取队列中的请求状态
 */
export async function getQueueStatus(
  requestId: string,
  modelType: "text-to-image" | "image-to-image" = "text-to-image"
) {
  configureFal();

  const modelId = modelType === "image-to-image" 
    ? "fal-ai/nano-banana/edit" 
    : "fal-ai/nano-banana";

  return await fal.queue.status(modelId, {
    requestId,
    logs: true,
  });
}

/**
 * 获取队列中的请求结果
 */
export async function getQueueResult(
  requestId: string,
  modelType: "text-to-image" | "image-to-image" = "text-to-image"
): Promise<GenerateImageOutput> {
  configureFal();

  const modelId = modelType === "image-to-image" 
    ? "fal-ai/nano-banana/edit" 
    : "fal-ai/nano-banana";

  const result = await fal.queue.result(modelId, {
    requestId,
  });

  return result.data as GenerateImageOutput;
}

// ============= Kling Video 类型定义 =============

// 视频生成方式枚举
export type VideoGenerationType = 
  | "image-to-video"      // 首尾帧过渡
  | "reference-to-video"  // 多图参考（当前）
  | "video-to-video";     // 视频续写

// 模型层级（预留Pro版本支持）
export type ModelTier = "standard" | "pro";

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

// Kling O1 首尾帧配置（image-to-video）
export interface KlingO1ImageToVideoInput {
  prompt: string;
  start_image_url: string;      // 起始帧（必填）
  end_image_url?: string;        // 结束帧（可选）
  duration?: VideoDuration;
  negative_prompt?: string;
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
      negative_prompt: input.negative_prompt ?? "blur, distort, low quality, subtitles",
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
        negative_prompt: input.negative_prompt ?? "blur, distort, low quality, subtitles",
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

// ============= Kling O1 Reference-to-Video 类型定义 =============

/**
 * Kling O1 Element - 角色/物体元素定义
 */
export interface KlingO1Element {
  frontal_image_url: string;      // 主图（正面图/主要视角）
  reference_image_urls?: string[]; // 参考图（其他角度/动作/表情）
}

/**
 * Kling O1 Reference-to-Video 输入参数
 *
 * 注意：如果要指定起始帧，将其放在 image_urls 的第一位，并在 prompt 中用 @Image1 引用
 */
export interface KlingO1ReferenceToVideoInput {
  prompt: string;                     // 详细的视频描述，使用 @Element1, @Image1 等引用图片
  elements?: KlingO1Element[];        // 角色/物体元素数组（最多7张图片总计）
  image_urls?: string[];              // 参考图数组（用于风格、场景、氛围等）
  duration?: VideoDuration;           // 视频时长：5秒或10秒
  aspect_ratio?: VideoAspectRatio;    // 宽高比
  negative_prompt?: string;           // 负面提示词
}

/**
 * Kling O1 Video-to-Video 输入参数（视频续写）
 * 
 * 基于现有视频片段生成下一段，保持风格和运动连贯性
 */
export interface VideoToVideoInput {
  prompt: string;                     // 详细描述，使用 @Video1 引用视频，@Image1/@Element1 引用图片
  video_url: string;                  // 参考视频URL（必填）
  image_urls?: string[];              // 可选：风格/场景参考图
  elements?: KlingO1Element[];        // 可选：角色元素
  duration?: VideoDuration;           // 视频时长：5秒或10秒
  aspect_ratio?: VideoAspectRatio;    // 宽高比
  negative_prompt?: string;           // 负面提示词
}

// ============= Kling O1 Reference-to-Video 接口 =============

/**
 * 使用 Kling O1 Reference-to-Video API 生成视频
 * 
 * 支持特性：
 * - 多张参考图组合
 * - 起始帧控制
 * - 角色一致性（通过 elements）
 * - 复杂镜头运动
 * 
 * API 文档: https://fal.ai/models/fal-ai/kling-video/o1/standard/reference-to-video
 */
export async function generateReferenceToVideo(
  input: KlingO1ReferenceToVideoInput
): Promise<ImageToVideoOutput> {
  configureFal();

  // 处理所有图片 URL（如果是 R2 key，转换为公开 URL）
  const processImageUrl = async (url: string): Promise<string> => {
    if (!url.startsWith("http")) {
      const publicUrl = getImageUrl(url);
      return publicUrl || url;
    }
    return url;
  };

  // 处理 elements
  const processedElements = input.elements 
    ? await Promise.all(
        input.elements.map(async (element) => ({
          frontal_image_url: await processImageUrl(element.frontal_image_url),
          reference_image_urls: element.reference_image_urls
            ? await Promise.all(element.reference_image_urls.map(processImageUrl))
            : undefined,
        }))
      )
    : undefined;

  // 处理全局参考图
  const processedImageUrls = input.image_urls
    ? await Promise.all(input.image_urls.map(processImageUrl))
    : undefined;

  const result = await fal.subscribe(
    "fal-ai/kling-video/o1/standard/reference-to-video",
    {
      input: {
        prompt: input.prompt,
        elements: processedElements,
        image_urls: processedImageUrls,
        duration: input.duration ?? "5",
        aspect_ratio: input.aspect_ratio ?? "16:9",
        negative_prompt: input.negative_prompt ?? "blur, distort, low quality, subtitles",
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    }
  );

  return result.data as ImageToVideoOutput;
}

/**
 * 使用队列方式提交 Kling O1 Reference-to-Video 请求
 */
export async function queueReferenceToVideo(
  input: KlingO1ReferenceToVideoInput,
  webhookUrl?: string
): Promise<{ request_id: string }> {
  configureFal();

  // 处理图片 URL（同上）
  const processImageUrl = async (url: string): Promise<string> => {
    if (!url.startsWith("http")) {
      const publicUrl = getImageUrl(url);
      return publicUrl || url;
    }
    return url;
  };

  const processedElements = input.elements 
    ? await Promise.all(
        input.elements.map(async (element) => ({
          frontal_image_url: await processImageUrl(element.frontal_image_url),
          reference_image_urls: element.reference_image_urls
            ? await Promise.all(element.reference_image_urls.map(processImageUrl))
            : undefined,
        }))
      )
    : undefined;

  const processedImageUrls = input.image_urls
    ? await Promise.all(input.image_urls.map(processImageUrl))
    : undefined;

  const { request_id } = await fal.queue.submit(
    "fal-ai/kling-video/o1/standard/reference-to-video",
    {
      input: {
        prompt: input.prompt,
        elements: processedElements,
        image_urls: processedImageUrls,
        duration: input.duration ?? "5",
        aspect_ratio: input.aspect_ratio ?? "16:9",
        negative_prompt: input.negative_prompt ?? "blur, distort, low quality, subtitles",
      },
      webhookUrl,
    }
  );

  return { request_id };
}

// ============= Kling O1 Image-to-Video（首尾帧）接口 =============

/**
 * 使用 Kling O1 Image-to-Video API 生成首尾帧过渡视频
 * 
 * 支持特性：
 * - 平滑的首尾帧过渡动画
 * - 可选的结束帧（只提供起始帧则自动生成运动）
 * - 适合场景切换、时间流逝等效果
 * 
 * API 文档: https://fal.ai/models/fal-ai/kling-video/o1/standard/image-to-video
 */
export async function generateKlingO1ImageToVideo(
  input: KlingO1ImageToVideoInput
): Promise<ImageToVideoOutput> {
  configureFal();

  // 处理图片 URL（如果是 R2 key，转换为公开 URL）
  const processImageUrl = async (url: string): Promise<string> => {
    if (!url.startsWith("http")) {
      const publicUrl = getImageUrl(url);
      return publicUrl || url;
    }
    return url;
  };

  const startImageUrl = await processImageUrl(input.start_image_url);
  const endImageUrl = input.end_image_url 
    ? await processImageUrl(input.end_image_url)
    : undefined;

  const result = await fal.subscribe(
    "fal-ai/kling-video/o1/standard/image-to-video",
    {
      input: {
        prompt: input.prompt,
        start_image_url: startImageUrl,
        end_image_url: endImageUrl,
        duration: input.duration ?? "5",
        negative_prompt: input.negative_prompt ?? "blur, distort, low quality, subtitles",
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    }
  );

  return result.data as ImageToVideoOutput;
}

// ============= Kling O1 Video-to-Video（视频续写）接口 =============

/**
 * 使用 Kling O1 Video-to-Video API 生成视频续写
 * 
 * 支持特性：
 * - 基于参考视频生成下一段
 * - 保持运动风格和镜头语言连贯
 * - 可结合角色元素和风格参考图
 * 
 * API 文档: https://fal.ai/models/fal-ai/kling-video/o1/standard/video-to-video/reference
 */
export async function generateVideoToVideo(
  input: VideoToVideoInput
): Promise<ImageToVideoOutput> {
  configureFal();

  // 处理所有 URL（视频和图片）
  const processUrl = async (url: string): Promise<string> => {
    if (!url.startsWith("http")) {
      const publicUrl = getImageUrl(url);
      return publicUrl || url;
    }
    return url;
  };

  const videoUrl = await processUrl(input.video_url);

  // 处理 elements（如果有）
  const processedElements = input.elements 
    ? await Promise.all(
        input.elements.map(async (element) => ({
          frontal_image_url: await processUrl(element.frontal_image_url),
          reference_image_urls: element.reference_image_urls
            ? await Promise.all(element.reference_image_urls.map(processUrl))
            : undefined,
        }))
      )
    : undefined;

  // 处理全局参考图（如果有）
  const processedImageUrls = input.image_urls
    ? await Promise.all(input.image_urls.map(processUrl))
    : undefined;

  const result = await fal.subscribe(
    "fal-ai/kling-video/o1/standard/video-to-video/reference",
    {
      input: {
        prompt: input.prompt,
        video_url: videoUrl,
        elements: processedElements,
        image_urls: processedImageUrls,
        duration: input.duration ?? "5",
        aspect_ratio: input.aspect_ratio ?? "16:9",
        negative_prompt: input.negative_prompt ?? "blur, distort, low quality, subtitles",
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    }
  );

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

