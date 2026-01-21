// Kie.ai Seedance 1.5 Pro 视频生成服务

import { getImageUrl } from "@/lib/storage/r2.service";
import { createTask, getTaskDetails } from "./task";

// ============= 类型定义 =============

export type SeedanceDuration = "4" | "8" | "12";
export type SeedanceAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "21:9";
export type SeedanceResolution = "480p" | "720p";

/**
 * Seedance 1.5 Pro 生成视频输入参数
 */
export interface SeedanceGenerateInput {
  prompt: string;
  imageUrls?: string[]; // 0-2 images
  aspectRatio?: SeedanceAspectRatio;
  duration: SeedanceDuration;
  resolution?: SeedanceResolution;
  fixedLens?: boolean;
  generateAudio?: boolean;
  callBackUrl?: string;
}

/**
 * Seedance 视频输出
 */
export interface SeedanceVideoOutput {
  taskId: string;
  videoUrl?: string;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

// ============= Seedance API 接口 =============

/**
 * 使用 Seedance 1.5 Pro 生成视频
 *
 * 支持：
 * - 文生视频（不提供图片）
 * - 图生视频（1-2张图片）
 *
 * 价格：$0.0175/秒
 * 视频时长：4/8/12 秒
 */
export async function generateSeedanceVideo(
  input: SeedanceGenerateInput
): Promise<SeedanceVideoOutput> {
  // 处理图片 URL：如果是 R2 key，转换为公开 URL
  let processedImageUrls: string[] | undefined;
  if (input.imageUrls && input.imageUrls.length > 0) {
    processedImageUrls = await Promise.all(
      input.imageUrls.map(async (url) => {
        if (!url.startsWith("http")) {
          const publicUrl = getImageUrl(url);
          return publicUrl || url;
        }
        return url;
      })
    );
  }

  // 构建 API 请求参数 (使用 snake_case 匹配 API)
  const apiInput: Record<string, unknown> = {
    prompt: input.prompt,
    duration: input.duration,
    aspect_ratio: input.aspectRatio || "16:9",
    resolution: input.resolution || "720p",
    generate_audio: input.generateAudio ?? false,
    ...(processedImageUrls && { input_urls: processedImageUrls }),
    ...(input.fixedLens !== undefined && { fixed_lens: input.fixedLens }),
  };

  console.log(`[Kie Seedance] 发起视频生成请求:`, apiInput);

  const taskId = await createTask(
    "bytedance/seedance-1.5-pro",
    apiInput,
    input.callBackUrl
  );

  console.log(`[Kie Seedance] 任务已创建: ${taskId}`);

  return {
    taskId,
    status: "pending",
  };
}

/**
 * 获取 Seedance 视频生成任务详情
 */
export async function getSeedanceVideoDetails(
  taskId: string
): Promise<SeedanceVideoOutput> {
  const taskDetails = await getTaskDetails(taskId);

  let status: SeedanceVideoOutput["status"];
  let videoUrl: string | undefined;
  let error: string | undefined;

  switch (taskDetails.state) {
    case "waiting":
    case "queuing":
      status = "pending";
      break;
    case "generating":
      status = "processing";
      break;
    case "success":
      status = "completed";
      if (taskDetails.resultJson) {
        try {
          const result = JSON.parse(taskDetails.resultJson) as {
            resultUrls?: string[];
          };
          videoUrl = result.resultUrls?.[0];
        } catch {
          console.error("[Kie Seedance] 解析 resultJson 失败:", taskDetails.resultJson);
        }
      }
      break;
    case "fail":
      status = "failed";
      error = taskDetails.failMsg || "未知错误";
      break;
    default:
      status = "pending";
  }

  return {
    taskId,
    status,
    videoUrl,
    error,
  };
}

/**
 * 轮询等待 Seedance 视频生成完成
 *
 * @param taskId 任务ID
 * @param maxAttempts 最大尝试次数（默认90次，约15分钟）
 * @param interval 轮询间隔（毫秒，默认10秒）
 */
export async function waitForSeedanceVideo(
  taskId: string,
  maxAttempts = 90,
  interval = 10000
): Promise<SeedanceVideoOutput> {
  let attempts = 0;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;

  while (attempts < maxAttempts) {
    try {
      const details = await getSeedanceVideoDetails(taskId);
      consecutiveErrors = 0;

      if (details.status === "completed" && details.videoUrl) {
        console.log(`[Kie Seedance] 视频生成完成: ${details.videoUrl}`);
        return details;
      }

      if (details.status === "failed") {
        throw new Error(`Seedance 视频生成失败: ${details.error || "未知错误"}`);
      }

      attempts++;
      console.log(`[Kie Seedance] 等待视频生成... (${attempts}/${maxAttempts})`);

      await new Promise((resolve) => setTimeout(resolve, interval));
    } catch (error) {
      const isNetworkError =
        error instanceof Error &&
        (error.message.includes("fetch failed") ||
          error.message.includes("ECONNRESET") ||
          error.message.includes("ETIMEDOUT") ||
          error.message.includes("network"));

      if (isNetworkError) {
        consecutiveErrors++;
        console.warn(
          `[Kie Seedance] 网络错误 (${consecutiveErrors}/${maxConsecutiveErrors}):`,
          error instanceof Error ? error.message : error
        );

        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw new Error(
            `Seedance 连续网络错误超过 ${maxConsecutiveErrors} 次，放弃重试`
          );
        }

        const backoff = Math.min(
          2000 * Math.pow(2, consecutiveErrors - 1),
          32000
        );
        console.log(`[Kie Seedance] ${backoff / 1000}秒后重试...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Seedance 视频生成超时（已尝试 ${maxAttempts} 次）`);
}
