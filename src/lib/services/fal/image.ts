// Fal.ai Nano Banana 图像生成服务

import { fal } from "@fal-ai/client";
import { getImageUrl } from "@/lib/storage/r2.service";
import { configureFal } from "./config";
import type {
  TextToImageInput,
  ImageToImageInput,
  GenerateImageOutput,
} from "./types";

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

  const modelId =
    modelType === "image-to-image"
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

  const modelId =
    modelType === "image-to-image"
      ? "fal-ai/nano-banana/edit"
      : "fal-ai/nano-banana";

  const result = await fal.queue.result(modelId, {
    requestId,
  });

  return result.data as GenerateImageOutput;
}
