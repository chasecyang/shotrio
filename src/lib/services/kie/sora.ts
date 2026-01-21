// Kie.ai Sora 2 视频生成服务

import { getImageUrl } from "@/lib/storage/r2.service";
import { createTask, getTaskDetails } from "./task";

// ============= 类型定义 =============

export type Sora2Model =
  | "sora-2-text-to-video"
  | "sora-2-image-to-video"
  | "sora-2-pro-text-to-video"
  | "sora-2-pro-image-to-video"
  | "sora-2-characters";

export type Sora2AspectRatio = "portrait" | "landscape";
export type Sora2Duration = "10" | "15";
export type Sora2Size = "standard" | "high";

/**
 * Sora 2 生成视频输入参数
 */
export interface Sora2GenerateInput {
  model: Sora2Model;
  prompt: string;
  imageUrls?: string[]; // 图生视频必填
  aspectRatio?: Sora2AspectRatio;
  duration?: Sora2Duration; // API 中为 n_frames
  size?: Sora2Size;
  removeWatermark?: boolean;
  characterIdList?: string[]; // 角色模型用，最多5个
  callBackUrl?: string;
}

/**
 * Sora 2 视频输出
 */
export interface Sora2VideoOutput {
  taskId: string;
  videoUrl?: string;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

// ============= Sora 2 API 接口 =============

/**
 * 使用 Sora 2 生成视频
 *
 * 支持五种模型：
 * - sora-2-text-to-video: 文生视频
 * - sora-2-image-to-video: 图生视频
 * - sora-2-pro-text-to-video: Pro 文生视频 (720P/1080P)
 * - sora-2-pro-image-to-video: Pro 图生视频 (720P/1080P)
 * - sora-2-characters: 角色一致性视频
 *
 * 价格：$0.015/秒（比 OpenAI 和 Fal.ai 低 60% 以上）
 * 视频时长：10 或 15 秒
 */
export async function generateSora2Video(
  input: Sora2GenerateInput
): Promise<Sora2VideoOutput> {
  // 验证图生视频模型必须提供图片
  const isImageToVideo =
    input.model === "sora-2-image-to-video" ||
    input.model === "sora-2-pro-image-to-video";

  if (isImageToVideo && (!input.imageUrls || input.imageUrls.length === 0)) {
    throw new Error(`模型 ${input.model} 需要提供 imageUrls 参数`);
  }

  // 验证角色 ID 数量
  if (input.characterIdList && input.characterIdList.length > 5) {
    throw new Error("characterIdList 最多支持 5 个角色 ID");
  }

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
    ...(processedImageUrls && { image_urls: processedImageUrls }),
    ...(input.aspectRatio && { aspect_ratio: input.aspectRatio }),
    ...(input.duration && { n_frames: input.duration }),
    ...(input.size && { size: input.size }),
    ...(input.removeWatermark !== undefined && {
      remove_watermark: input.removeWatermark,
    }),
    ...(input.characterIdList && { character_id_list: input.characterIdList }),
  };

  console.log(`[Kie Sora2] 发起视频生成请求: model=${input.model}`, apiInput);

  const taskId = await createTask(input.model, apiInput, input.callBackUrl);

  console.log(`[Kie Sora2] 任务已创建: ${taskId}`);

  return {
    taskId,
    status: "pending",
  };
}

/**
 * 获取 Sora 2 视频生成任务详情
 *
 * @param taskId 任务ID
 */
export async function getSora2VideoDetails(
  taskId: string
): Promise<Sora2VideoOutput> {
  const taskDetails = await getTaskDetails(taskId);

  // 根据 state 转换状态
  let status: Sora2VideoOutput["status"];
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
          console.error("[Kie Sora2] 解析 resultJson 失败:", taskDetails.resultJson);
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
 * 轮询等待 Sora 2 视频生成完成
 *
 * @param taskId 任务ID
 * @param maxAttempts 最大尝试次数（默认90次，约15分钟）
 * @param interval 轮询间隔（毫秒，默认10秒）
 */
export async function waitForSora2Video(
  taskId: string,
  maxAttempts = 90,
  interval = 10000
): Promise<Sora2VideoOutput> {
  let attempts = 0;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;

  while (attempts < maxAttempts) {
    try {
      const details = await getSora2VideoDetails(taskId);
      consecutiveErrors = 0; // 成功后重置错误计数

      if (details.status === "completed" && details.videoUrl) {
        console.log(`[Kie Sora2] 视频生成完成: ${details.videoUrl}`);
        return details;
      }

      if (details.status === "failed") {
        throw new Error(`Sora2 视频生成失败: ${details.error || "未知错误"}`);
      }

      attempts++;
      console.log(`[Kie Sora2] 等待视频生成... (${attempts}/${maxAttempts})`);

      // 等待指定时间后继续轮询
      await new Promise((resolve) => setTimeout(resolve, interval));
    } catch (error) {
      // 检查是否是网络错误（可重试）
      const isNetworkError =
        error instanceof Error &&
        (error.message.includes("fetch failed") ||
          error.message.includes("ECONNRESET") ||
          error.message.includes("ETIMEDOUT") ||
          error.message.includes("network"));

      if (isNetworkError) {
        consecutiveErrors++;
        console.warn(
          `[Kie Sora2] 网络错误 (${consecutiveErrors}/${maxConsecutiveErrors}):`,
          error instanceof Error ? error.message : error
        );

        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw new Error(
            `Sora2 连续网络错误超过 ${maxConsecutiveErrors} 次，放弃重试`
          );
        }

        // 指数退避：2s, 4s, 8s, 16s, 32s
        const backoff = Math.min(
          2000 * Math.pow(2, consecutiveErrors - 1),
          32000
        );
        console.log(`[Kie Sora2] ${backoff / 1000}秒后重试...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      // 非网络错误直接抛出
      throw error;
    }
  }

  throw new Error(`Sora2 视频生成超时（已尝试 ${maxAttempts} 次）`);
}
