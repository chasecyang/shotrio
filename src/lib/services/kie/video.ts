// Kie.ai Veo 3.1 视频生成服务

import { getImageUrl } from "@/lib/storage/r2.service";
import { KIE_API_BASE_URL, getKieApiKey } from "./config";

// ============= 类型定义 =============

export type Veo3Model = "veo3" | "veo3_fast";
export type Veo3AspectRatio = "16:9" | "9:16" | "Auto";
export type Veo3GenerationType =
  | "TEXT_2_VIDEO" // 文生视频
  | "FIRST_AND_LAST_FRAMES_2_VIDEO" // 首尾帧过渡
  | "REFERENCE_2_VIDEO"; // 参考图生成

/**
 * Veo 3.1 生成视频的响应
 */
export interface Veo3GenerateResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

/**
 * Veo 3.1 视频详情响应
 */
export interface Veo3VideoDetails {
  code: number;
  msg: string;
  data: {
    taskId: string;
    successFlag: 0 | 1 | 2 | 3; // 0=生成中, 1=成功, 2=失败, 3=失败
    response?: {
      resultUrls?: string[];
    };
    errorMessage?: string;
  };
}

/**
 * Veo 3.1 生成视频输入参数
 */
export interface Veo3GenerateInput {
  prompt: string; // 视频描述（必填）
  imageUrls?: string[]; // 参考图片URL数组（1-2张）
  model?: Veo3Model; // 模型选择（默认 veo3_fast）
  generationType?: Veo3GenerationType; // 生成类型
  aspectRatio?: Veo3AspectRatio; // 宽高比（默认16:9）
  seeds?: number; // 随机种子（10000-99999）
  callBackUrl?: string; // 回调URL
  enableTranslation?: boolean; // 是否启用提示词翻译（默认true）
  watermark?: string; // 水印文字
}

/**
 * Veo 3.1 视频输出
 */
export interface Veo3VideoOutput {
  taskId: string;
  videoUrl?: string;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

// ============= Veo 3.1 API 接口 =============

/**
 * 使用 Veo 3.1 生成视频
 *
 * 支持三种生成模式：
 * - TEXT_2_VIDEO: 纯文本生成视频
 * - FIRST_AND_LAST_FRAMES_2_VIDEO: 首尾帧过渡（1-2张图片）
 * - REFERENCE_2_VIDEO: 基于参考图生成（1-3张图片，仅支持 veo3_fast 和 16:9）
 *
 * 价格：Google官方价格的 25%
 * 视频时长：约8秒
 *
 * @see https://docs.kie.ai/veo3-api/generate-veo-3-video
 */
export async function generateVeo3Video(
  input: Veo3GenerateInput
): Promise<Veo3VideoOutput> {
  const apiKey = getKieApiKey();

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

  // 自动判断生成类型：默认使用参考图生成模式
  let generationType = input.generationType;
  if (!generationType && processedImageUrls && processedImageUrls.length > 0) {
    generationType = "REFERENCE_2_VIDEO";
  }

  const requestBody = {
    prompt: input.prompt,
    ...(processedImageUrls && { imageUrls: processedImageUrls }),
    model: input.model || "veo3_fast",
    ...(generationType && { generationType }),
    aspectRatio: input.aspectRatio || "16:9",
    ...(input.seeds && { seeds: input.seeds }),
    ...(input.callBackUrl && { callBackUrl: input.callBackUrl }),
    enableTranslation: input.enableTranslation !== false,
    ...(input.watermark && { watermark: input.watermark }),
  };

  console.log("[Kie Veo3] 发起视频生成请求:", requestBody);

  const response = await fetch(`${KIE_API_BASE_URL}/veo/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Kie.ai Veo3 API error:", error);
    throw new Error(`Kie.ai Veo3 API failed: ${response.status} ${error}`);
  }

  const data = (await response.json()) as Veo3GenerateResponse;

  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(`Veo3 生成失败: ${data.msg || "未知错误"}`);
  }

  console.log("[Kie Veo3] 任务已创建:", data.data.taskId);

  return {
    taskId: data.data.taskId,
    status: "pending",
  };
}

/**
 * 获取 Veo 3.1 视频生成任务详情
 *
 * @param taskId 任务ID
 * @see https://docs.kie.ai/veo3-api/generate-veo-3-video
 */
export async function getVeo3VideoDetails(
  taskId: string
): Promise<Veo3VideoOutput> {
  const apiKey = getKieApiKey();

  const response = await fetch(
    `${KIE_API_BASE_URL}/veo/record-info?taskId=${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Kie.ai Veo3 详情查询失败:", error);
    throw new Error(`Kie.ai Veo3 详情查询失败: ${response.status} ${error}`);
  }

  const data = (await response.json()) as Veo3VideoDetails;

  if (data.code !== 200) {
    throw new Error(`Veo3 详情查询失败: ${data.msg || "未知错误"}`);
  }

  // 根据 successFlag 转换状态
  // 0=生成中, 1=成功, 2=失败, 3=失败
  let status: Veo3VideoOutput["status"];
  let videoUrl: string | undefined;

  switch (data.data.successFlag) {
    case 0:
      status = "processing";
      break;
    case 1:
      status = "completed";
      // resultUrls 在 response 对象内，是数组
      if (data.data.response?.resultUrls?.[0]) {
        videoUrl = data.data.response.resultUrls[0];
      }
      break;
    case 2:
    case 3:
      status = "failed";
      break;
    default:
      status = "pending";
  }

  return {
    taskId: data.data.taskId,
    status,
    videoUrl,
    error: data.data.errorMessage,
  };
}

/**
 * 轮询等待 Veo 3.1 视频生成完成
 *
 * @param taskId 任务ID
 * @param maxAttempts 最大尝试次数（默认60次，约10分钟）
 * @param interval 轮询间隔（毫秒，默认10秒）
 */
export async function waitForVeo3Video(
  taskId: string,
  maxAttempts = 60,
  interval = 10000
): Promise<Veo3VideoOutput> {
  let attempts = 0;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;

  while (attempts < maxAttempts) {
    try {
      const details = await getVeo3VideoDetails(taskId);
      consecutiveErrors = 0; // 成功后重置错误计数

      if (details.status === "completed" && details.videoUrl) {
        console.log(`[Kie Veo3] 视频生成完成: ${details.videoUrl}`);
        return details;
      }

      if (details.status === "failed") {
        throw new Error(`Veo3 视频生成失败: ${details.error || "未知错误"}`);
      }

      attempts++;
      console.log(`[Kie Veo3] 等待视频生成... (${attempts}/${maxAttempts})`);

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
          `[Kie Veo3] 网络错误 (${consecutiveErrors}/${maxConsecutiveErrors}):`,
          error instanceof Error ? error.message : error
        );

        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw new Error(
            `Veo3 连续网络错误超过 ${maxConsecutiveErrors} 次，放弃重试`
          );
        }

        // 指数退避：2s, 4s, 8s, 16s, 32s
        const backoff = Math.min(
          2000 * Math.pow(2, consecutiveErrors - 1),
          32000
        );
        console.log(`[Kie Veo3] ${backoff / 1000}秒后重试...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      // 非网络错误直接抛出
      throw error;
    }
  }

  throw new Error(`Veo3 视频生成超时（已尝试 ${maxAttempts} 次）`);
}
