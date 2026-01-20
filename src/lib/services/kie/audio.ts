// Kie.ai 音频生成服务
// - ElevenLabs Sound Effect V2: 音效生成
// - Suno Music Generation: 背景音乐生成

import { KIE_API_BASE_URL, getKieApiKey, getKieCallbackUrl } from "./config";
import { createTask, waitForTaskCompletion } from "./task";

// ============= 类型定义 =============

// ElevenLabs Sound Effect 输出格式
export type SoundEffectOutputFormat =
  | "mp3_22050_32"
  | "mp3_44100_32"
  | "mp3_44100_64"
  | "mp3_44100_96"
  | "mp3_44100_128"
  | "mp3_44100_192"
  | "pcm_16000"
  | "pcm_22050"
  | "pcm_24000"
  | "pcm_44100"
  | "pcm_48000"
  | "ulaw_8000"
  | "alaw_8000"
  | "opus_48000_32"
  | "opus_48000_64"
  | "opus_48000_96"
  | "opus_48000_128"
  | "opus_48000_192";

/**
 * ElevenLabs Sound Effect 输入参数
 */
export interface SoundEffectInput {
  text: string; // 音效描述（必填）
  loop?: boolean; // 是否循环播放
  duration_seconds?: number; // 时长 0.5-22 秒
  prompt_influence?: number; // 提示词影响力 0-1
  output_format?: SoundEffectOutputFormat; // 输出格式
}

/**
 * 音效生成输出
 */
export interface SoundEffectOutput {
  audioUrl: string;
  duration?: number; // 毫秒
  format: string;
}

// Suno Music 模型版本
export type SunoModel = "V4" | "V4_5" | "V4_5PLUS" | "V4_5ALL" | "V5";

/**
 * Suno Music Generation 输入参数
 */
export interface MusicGenerationInput {
  prompt: string; // 歌词或描述（必填）
  customMode: boolean; // 是否启用自定义模式
  instrumental: boolean; // 是否纯音乐（无人声）
  model: SunoModel; // 模型版本
  style?: string; // 风格（customMode 时必填）
  title?: string; // 标题（customMode 时必填）
  negativeTags?: string; // 排除的风格
  vocalGender?: "m" | "f"; // 人声性别
  styleWeight?: number; // 风格权重 0-1
  weirdnessConstraint?: number; // 创意约束 0-1
  audioWeight?: number; // 音频权重 0-1
  personaId?: string; // 人设 ID
  callBackUrl?: string; // 回调 URL
}

/**
 * Suno Music 生成响应
 */
export interface MusicGenerateResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

/**
 * Suno Music 任务详情响应
 * 注意：API 返回的状态是大写的，数据在 response.sunoData 中
 */
export interface MusicTaskDetails {
  code: number;
  msg: string;
  data: {
    taskId: string;
    status:
      | "PENDING"
      | "TEXT_SUCCESS"
      | "FIRST_SUCCESS"
      | "SUCCESS"
      | "CREATE_TASK_FAILED"
      | "GENERATE_AUDIO_FAILED"
      | "CALLBACK_EXCEPTION"
      | "SENSITIVE_WORD_ERROR";
    response?: {
      sunoData?: Array<{
        id: string;
        audioUrl: string;
        imageUrl?: string;
        title?: string;
        duration?: number;
      }>;
    };
    errorCode?: string | null;
    errorMessage?: string | null;
  };
}

/**
 * 音乐生成输出
 */
export interface MusicGenerationOutput {
  taskId: string;
  audioUrl?: string;
  duration?: number; // 毫秒
  title?: string;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

// ============= ElevenLabs Sound Effect API =============

/**
 * 使用 ElevenLabs Sound Effect V2 生成音效
 *
 * 特性：
 * - 支持最长 30 秒的音效
 * - 48kHz 专业音频质量
 * - 可创建无缝循环音效
 * - 商用免版税
 *
 * 价格：$0.0012/次
 *
 * @see https://kie.ai/elevenlabs-sound-effect
 */
export async function generateSoundEffect(
  input: SoundEffectInput
): Promise<SoundEffectOutput> {
  // 构建任务输入
  const taskInput: Record<string, unknown> = {
    text: input.text,
  };

  if (input.loop !== undefined) {
    taskInput.loop = input.loop;
  }

  if (input.duration_seconds !== undefined) {
    // 限制在 0.5-22 秒范围内
    taskInput.duration_seconds = Math.min(
      Math.max(input.duration_seconds, 0.5),
      22
    );
  }

  if (input.prompt_influence !== undefined) {
    // 限制在 0-1 范围内
    taskInput.prompt_influence = Math.min(
      Math.max(input.prompt_influence, 0),
      1
    );
  }

  if (input.output_format) {
    taskInput.output_format = input.output_format;
  }

  console.log("[Kie Audio] 发起音效生成请求:", taskInput);

  // 创建任务
  const taskId = await createTask("elevenlabs/sound-effect-v2", taskInput);

  // 等待任务完成（音效生成通常较快）
  const audioUrls = await waitForTaskCompletion(taskId, 30, 3000);

  if (!audioUrls || audioUrls.length === 0) {
    throw new Error("音效生成失败：未返回音频URL");
  }

  // 从输出格式推断格式类型
  const format = input.output_format?.split("_")[0] || "mp3";

  return {
    audioUrl: audioUrls[0],
    format,
  };
}

// ============= Suno Music Generation API =============

/**
 * 使用 Suno 生成背景音乐
 *
 * 特性：
 * - 支持多种模型版本（V4, V4.5, V5）
 * - 自定义模式支持风格、标题设置
 * - 支持纯音乐或带人声
 * - 可指定人声性别
 *
 * 价格：$0.06/次
 *
 * @see https://docs.kie.ai/suno-api/generate-music
 */
export async function generateMusic(
  input: MusicGenerationInput
): Promise<MusicGenerationOutput> {
  const apiKey = getKieApiKey();

  const requestBody: Record<string, unknown> = {
    prompt: input.prompt,
    customMode: input.customMode,
    instrumental: input.instrumental,
    model: input.model,
  };

  // 自定义模式下的必填字段
  if (input.customMode) {
    if (input.style) requestBody.style = input.style;
    if (input.title) requestBody.title = input.title;
  }

  // 可选字段
  if (input.negativeTags) requestBody.negativeTags = input.negativeTags;
  if (input.vocalGender) requestBody.vocalGender = input.vocalGender;
  if (input.styleWeight !== undefined) requestBody.styleWeight = input.styleWeight;
  if (input.weirdnessConstraint !== undefined)
    requestBody.weirdnessConstraint = input.weirdnessConstraint;
  if (input.audioWeight !== undefined) requestBody.audioWeight = input.audioWeight;
  if (input.personaId) requestBody.personaId = input.personaId;

  // 回调 URL（API 必填，但我们使用轮询方式获取结果）
  requestBody.callBackUrl = input.callBackUrl || getKieCallbackUrl();

  console.log("[Kie Audio] 发起音乐生成请求:", requestBody);

  const response = await fetch(`${KIE_API_BASE_URL}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[Kie Audio] Suno API 错误:", error);
    throw new Error(`Suno API 失败: ${response.status} ${error}`);
  }

  const data = (await response.json()) as MusicGenerateResponse;

  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(`音乐生成失败: ${data.msg || "未知错误"}`);
  }

  console.log("[Kie Audio] 音乐生成任务已创建:", data.data.taskId);

  return {
    taskId: data.data.taskId,
    status: "pending",
  };
}

/**
 * 获取 Suno 音乐生成任务详情
 */
export async function getMusicTaskDetails(
  taskId: string
): Promise<MusicGenerationOutput> {
  const apiKey = getKieApiKey();

  const response = await fetch(
    `${KIE_API_BASE_URL}/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[Kie Audio] Suno 任务查询失败:", error);
    throw new Error(`Suno 任务查询失败: ${response.status} ${error}`);
  }

  const data = (await response.json()) as MusicTaskDetails;

  if (data.code !== 200) {
    throw new Error(`Suno 任务查询失败: ${data.msg || "未知错误"}`);
  }

  console.log(`[Kie Audio] 任务 ${taskId} 状态: ${data.data.status}`);

  // 转换状态
  let status: MusicGenerationOutput["status"];
  let audioUrl: string | undefined;
  let duration: number | undefined;
  let title: string | undefined;

  switch (data.data.status) {
    case "PENDING":
    case "TEXT_SUCCESS":
    case "FIRST_SUCCESS":
      status = "processing";
      break;
    case "SUCCESS":
      status = "completed";
      // 从 response.sunoData 获取歌曲数据
      if (
        data.data.response?.sunoData &&
        data.data.response.sunoData.length > 0
      ) {
        const song = data.data.response.sunoData[0];
        audioUrl = song.audioUrl;
        duration = song.duration ? song.duration * 1000 : undefined; // 转为毫秒
        title = song.title;
      }
      break;
    case "CREATE_TASK_FAILED":
    case "GENERATE_AUDIO_FAILED":
    case "CALLBACK_EXCEPTION":
    case "SENSITIVE_WORD_ERROR":
      status = "failed";
      break;
    default:
      status = "pending";
  }

  return {
    taskId: data.data.taskId,
    status,
    audioUrl,
    duration,
    title,
    error: data.data.errorMessage ?? undefined,
  };
}

/**
 * 轮询等待 Suno 音乐生成完成
 *
 * @param taskId 任务ID
 * @param maxAttempts 最大尝试次数（默认60次，约10分钟）
 * @param interval 轮询间隔（毫秒，默认10秒）
 */
export async function waitForMusic(
  taskId: string,
  maxAttempts = 60,
  interval = 10000
): Promise<MusicGenerationOutput> {
  let attempts = 0;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;

  while (attempts < maxAttempts) {
    try {
      const details = await getMusicTaskDetails(taskId);
      consecutiveErrors = 0;

      if (details.status === "completed" && details.audioUrl) {
        console.log(`[Kie Audio] 音乐生成完成: ${details.audioUrl}`);
        return details;
      }

      if (details.status === "failed") {
        throw new Error(`音乐生成失败: ${details.error || "未知错误"}`);
      }

      attempts++;
      console.log(`[Kie Audio] 等待音乐生成... (${attempts}/${maxAttempts})`);

      await new Promise((resolve) => setTimeout(resolve, interval));
    } catch (error) {
      // 检查是否是网络错误
      const isNetworkError =
        error instanceof Error &&
        (error.message.includes("fetch failed") ||
          error.message.includes("ECONNRESET") ||
          error.message.includes("ETIMEDOUT") ||
          error.message.includes("network"));

      if (isNetworkError) {
        consecutiveErrors++;
        console.warn(
          `[Kie Audio] 网络错误 (${consecutiveErrors}/${maxConsecutiveErrors}):`,
          error instanceof Error ? error.message : error
        );

        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw new Error(
            `Suno 连续网络错误超过 ${maxConsecutiveErrors} 次，放弃重试`
          );
        }

        const backoff = Math.min(
          2000 * Math.pow(2, consecutiveErrors - 1),
          32000
        );
        console.log(`[Kie Audio] ${backoff / 1000}秒后重试...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      throw error;
    }
  }

  throw new Error(`音乐生成超时（已尝试 ${maxAttempts} 次）`);
}
