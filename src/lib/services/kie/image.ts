// Kie.ai Nano Banana Pro 图像生成服务

import { getImageUrl } from "@/lib/storage/r2.service";
import { createTask, waitForTaskCompletion } from "./task";

// ============= 类型定义 =============

export type AspectRatio =
  | "21:9"
  | "16:9"
  | "3:2"
  | "4:3"
  | "5:4"
  | "1:1"
  | "4:5"
  | "3:4"
  | "2:3"
  | "9:16"
  | "auto";

export type ImageSize =
  | "1:1"
  | "9:16"
  | "16:9"
  | "3:4"
  | "4:3"
  | "3:2"
  | "2:3"
  | "5:4"
  | "4:5"
  | "21:9"
  | "auto";

export type OutputFormat = "jpeg" | "png" | "jpg" | "webp";

export interface GeneratedImage {
  url: string;
  content_type?: string;
  file_name?: string;
  file_size?: number;
  width?: number;
  height?: number;
}

export interface GenerateImageOutput {
  images: GeneratedImage[];
  description: string;
}

// 文生图输入参数（Nano Banana）
export interface TextToImageInput {
  prompt: string;
  num_images?: number;
  aspect_ratio?: AspectRatio;
  output_format?: OutputFormat;
  sync_mode?: boolean;
}

// 图生图/编辑输入参数（Nano Banana Edit）
export interface ImageToImageInput {
  prompt: string;
  image_urls: string[]; // 最多10张参考图
  num_images?: number;
  aspect_ratio?: AspectRatio;
  output_format?: OutputFormat;
  sync_mode?: boolean;
}

// Nano Banana Pro 输入参数
export interface NanoBananaProInput {
  prompt: string;
  image_input?: string[]; // 最多8张输入图片
  aspect_ratio?: AspectRatio;
  resolution?: "1K" | "2K" | "4K";
  output_format?: "png" | "jpg";
}

// ============= Nano Banana Pro 文生图接口 =============

/**
 * 使用 Kie.ai Nano Banana Pro 模型生成图像（文生图）
 * 固定使用 2K 分辨率
 * 价格：约 $0.12/张
 */
export async function generateImage(
  input: TextToImageInput
): Promise<GenerateImageOutput> {
  // 转换参数格式适配 Pro 版本
  const aspectRatio =
    input.aspect_ratio === "auto" ? "1:1" : (input.aspect_ratio ?? "1:1");

  // Pro 版本不支持 webp/jpeg，转换为 png
  const outputFormat =
    input.output_format === "webp" || input.output_format === "jpeg"
      ? "png"
      : input.output_format === "jpg"
        ? "jpg"
        : "png";

  // 调用 Pro 版本
  return generateImagePro({
    prompt: input.prompt,
    aspect_ratio: aspectRatio as AspectRatio,
    resolution: "2K",
    output_format: outputFormat as "png" | "jpg",
  });
}

// ============= Nano Banana Pro 图生图接口 =============

/**
 * 使用 Kie.ai Nano Banana Pro 模型编辑/转换图像（图生图）
 * 固定使用 2K 分辨率，支持最多8张参考图
 * 价格：约 $0.12/张
 */
export async function editImage(
  input: ImageToImageInput
): Promise<GenerateImageOutput> {
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

  // Pro 版本最多支持 8 张图片
  const limitedUrls = processedUrls.slice(0, 8);

  // 转换参数格式适配 Pro 版本
  const aspectRatio =
    !input.aspect_ratio || input.aspect_ratio === "auto"
      ? "16:9"
      : input.aspect_ratio;

  // Pro 版本不支持 webp/jpeg，转换为 png
  const outputFormat =
    input.output_format === "webp" || input.output_format === "jpeg"
      ? "png"
      : input.output_format === "jpg"
        ? "jpg"
        : "png";

  // 调用 Pro 版本，传入图片作为 image_input
  return generateImagePro({
    prompt: input.prompt,
    image_input: limitedUrls,
    aspect_ratio: aspectRatio as AspectRatio,
    resolution: "2K",
    output_format: outputFormat as "png" | "jpg",
  });
}

// ============= Nano Banana Pro 接口 =============

/**
 * 使用 Kie.ai Nano Banana Pro 模型生成高质量图像
 * 支持 4K 分辨率，更精确的文本渲染
 * 价格：约 $0.12/张（24 credits）
 */
export async function generateImagePro(
  input: NanoBananaProInput
): Promise<GenerateImageOutput> {
  // 处理图片输入（如果有）
  let processedImageInput: string[] | undefined;
  if (input.image_input) {
    processedImageInput = await Promise.all(
      input.image_input.map(async (url) => {
        if (!url.startsWith("http")) {
          const publicUrl = getImageUrl(url);
          return publicUrl || url;
        }
        return url;
      })
    );
  }

  const taskInput = {
    prompt: input.prompt,
    ...(processedImageInput && { image_input: processedImageInput }),
    aspect_ratio: input.aspect_ratio ?? "1:1",
    resolution: input.resolution ?? "2K",
    output_format: input.output_format ?? "png",
  };

  // 创建任务
  const taskId = await createTask("nano-banana-pro", taskInput);

  // 等待任务完成
  const imageUrls = await waitForTaskCompletion(taskId);

  // 转换为标准格式
  const images: GeneratedImage[] = imageUrls.map((url) => ({ url }));

  return {
    images,
    description: input.prompt,
  };
}
