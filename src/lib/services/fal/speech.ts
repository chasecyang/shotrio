// Fal.ai MiniMax Speech 2.6 Turbo 语音合成服务

import { fal } from "@fal-ai/client";
import { configureFal } from "./config";
import type { TextToSpeechInput, TextToSpeechOutput } from "./types";

// ============= Constants =============

const MINIMAX_SPEECH_MODEL = "fal-ai/minimax/speech-2.6-turbo";

// Default voice options
export const DEFAULT_VOICE_ID = "Wise_Woman";

// ============= Speech Generation =============

/**
 * 使用 MiniMax Speech 2.6 Turbo 生成语音
 *
 * 特性：
 * - 高质量 AI 语音合成
 * - 支持多种情感表达 (happy, sad, angry, etc.)
 * - 可调节语速、音量、音调
 * - 支持多种音频格式 (mp3, pcm, flac)
 * - 支持自定义停顿标记 <#x#> (x = 0.01-99.99秒)
 *
 * 价格：$0.06/1000字符
 *
 * @see https://fal.ai/models/fal-ai/minimax/speech-2.6-turbo
 */
export async function generateSpeech(
  input: TextToSpeechInput
): Promise<TextToSpeechOutput> {
  configureFal();

  // Build voice settings
  const voiceSetting: Record<string, unknown> = {
    voice_id: input.voice_id ?? DEFAULT_VOICE_ID,
  };

  if (input.speed !== undefined) {
    // Clamp to valid range 0.5-2.0
    voiceSetting.speed = Math.min(Math.max(input.speed, 0.5), 2.0);
  }

  if (input.vol !== undefined) {
    // Clamp to valid range 0-10
    voiceSetting.vol = Math.min(Math.max(input.vol, 0), 10);
  }

  if (input.pitch !== undefined) {
    // Clamp to valid range -12 to 12
    voiceSetting.pitch = Math.min(Math.max(input.pitch, -12), 12);
  }

  if (input.emotion) {
    voiceSetting.emotion = input.emotion;
  }

  // Build audio settings
  const audioSetting: Record<string, unknown> = {};

  if (input.sample_rate) {
    audioSetting.sample_rate = String(input.sample_rate);
  }

  if (input.bitrate) {
    audioSetting.bitrate = String(input.bitrate);
  }

  if (input.format) {
    audioSetting.format = input.format;
  }

  if (input.channel) {
    audioSetting.channel = String(input.channel);
  }

  // Build request input
  const requestInput: Record<string, unknown> = {
    prompt: input.prompt,
    voice_setting: voiceSetting,
    output_format: "url", // Always get URL for easier handling
  };

  if (Object.keys(audioSetting).length > 0) {
    requestInput.audio_setting = audioSetting;
  }

  if (input.language_boost) {
    requestInput.language_boost = input.language_boost;
  }

  console.log("[Fal Speech] 发起语音合成请求:", {
    prompt:
      input.prompt.substring(0, 50) + (input.prompt.length > 50 ? "..." : ""),
    voice_id: voiceSetting.voice_id,
    emotion: voiceSetting.emotion,
  });

  const result = await fal.subscribe(MINIMAX_SPEECH_MODEL, {
    input: requestInput,
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log) => log.message).forEach(console.log);
      }
    },
  });

  const data = result.data as TextToSpeechOutput;

  if (!data.audio?.url) {
    throw new Error("语音合成失败：未返回音频URL");
  }

  console.log(`[Fal Speech] 语音合成完成: ${data.duration_ms}ms`);

  return data;
}

/**
 * 使用队列方式提交语音合成请求
 */
export async function queueSpeech(
  input: TextToSpeechInput,
  webhookUrl?: string
): Promise<{ request_id: string }> {
  configureFal();

  const voiceSetting: Record<string, unknown> = {
    voice_id: input.voice_id ?? DEFAULT_VOICE_ID,
  };

  if (input.speed !== undefined) {
    voiceSetting.speed = Math.min(Math.max(input.speed, 0.5), 2.0);
  }
  if (input.vol !== undefined) {
    voiceSetting.vol = Math.min(Math.max(input.vol, 0), 10);
  }
  if (input.pitch !== undefined) {
    voiceSetting.pitch = Math.min(Math.max(input.pitch, -12), 12);
  }
  if (input.emotion) {
    voiceSetting.emotion = input.emotion;
  }

  const audioSetting: Record<string, unknown> = {};
  if (input.sample_rate) audioSetting.sample_rate = String(input.sample_rate);
  if (input.bitrate) audioSetting.bitrate = String(input.bitrate);
  if (input.format) audioSetting.format = input.format;
  if (input.channel) audioSetting.channel = String(input.channel);

  const requestInput: Record<string, unknown> = {
    prompt: input.prompt,
    voice_setting: voiceSetting,
    output_format: "url",
  };

  if (Object.keys(audioSetting).length > 0) {
    requestInput.audio_setting = audioSetting;
  }
  if (input.language_boost) {
    requestInput.language_boost = input.language_boost;
  }

  const { request_id } = await fal.queue.submit(MINIMAX_SPEECH_MODEL, {
    input: requestInput,
    webhookUrl,
  });

  return { request_id };
}

/**
 * 获取语音合成队列请求状态
 */
export async function getSpeechStatus(requestId: string) {
  configureFal();
  return await fal.queue.status(MINIMAX_SPEECH_MODEL, {
    requestId,
    logs: true,
  });
}

/**
 * 获取语音合成队列请求结果
 */
export async function getSpeechResult(
  requestId: string
): Promise<TextToSpeechOutput> {
  configureFal();
  const result = await fal.queue.result(MINIMAX_SPEECH_MODEL, {
    requestId,
  });
  return result.data as TextToSpeechOutput;
}
