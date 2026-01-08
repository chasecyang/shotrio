// Fal.ai Kling 视频生成服务

import { fal } from "@fal-ai/client";
import { getImageUrl } from "@/lib/storage/r2.service";
import { configureFal } from "./config";
import type {
  ImageToVideoInput,
  KlingO1ImageToVideoInput,
  ImageToVideoOutput,
} from "./types";

// Helper function for URL processing
async function processImageUrl(url: string): Promise<string> {
  if (!url.startsWith("http")) {
    const publicUrl = getImageUrl(url);
    return publicUrl || url;
  }
  return url;
}

// ============= Kling V2.6 Pro Image to Video =============

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

  const imageUrl = await processImageUrl(input.image_url);

  const result = await fal.subscribe(
    "fal-ai/kling-video/v2.6/pro/image-to-video",
    {
      input: {
        prompt: input.prompt,
        image_url: imageUrl,
        duration: input.duration ?? "5",
        negative_prompt:
          input.negative_prompt ?? "blur, distort, low quality, subtitles",
        generate_audio: input.generate_audio ?? true,
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
 * 使用队列方式提交图像转视频请求（适用于长时间生成）
 */
export async function queueImageToVideo(
  input: ImageToVideoInput,
  webhookUrl?: string
): Promise<{ request_id: string }> {
  configureFal();

  const imageUrl = await processImageUrl(input.image_url);

  const { request_id } = await fal.queue.submit(
    "fal-ai/kling-video/v2.6/pro/image-to-video",
    {
      input: {
        prompt: input.prompt,
        image_url: imageUrl,
        duration: input.duration ?? "5",
        negative_prompt:
          input.negative_prompt ?? "blur, distort, low quality, subtitles",
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

  const result = await fal.queue.result(
    "fal-ai/kling-video/v2.6/pro/image-to-video",
    {
      requestId,
    }
  );

  return result.data as ImageToVideoOutput;
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
        negative_prompt:
          input.negative_prompt ?? "blur, distort, low quality, subtitles",
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
