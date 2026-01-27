"use server";

/**
 * 音频生成处理器
 *
 * 统一处理 generate_sound_effect, generate_bgm, generate_dialogue 三种音频生成
 */

import type { FunctionCall, FunctionExecutionResult } from "@/types/agent";
import type { AssetMeta, AudioMeta } from "@/types/asset";
import { createAudioAsset } from "@/lib/actions/asset";

// 音频类型配置
interface AudioTypeConfig {
  purpose: "sound_effect" | "bgm" | "voiceover";
  defaultTags: string[];
  defaultNamePrefix: string;
  successMessage: string;
  errorMessage: string;
}

const AUDIO_TYPE_CONFIGS: Record<string, AudioTypeConfig> = {
  generate_sound_effect: {
    purpose: "sound_effect",
    defaultTags: ["sound-effect"],
    defaultNamePrefix: "SFX",
    successMessage: "Sound effect generation task created",
    errorMessage: "Failed to create sound effect generation task",
  },
  generate_bgm: {
    purpose: "bgm",
    defaultTags: ["BGM"],
    defaultNamePrefix: "BGM",
    successMessage: "Background music generation task created",
    errorMessage: "Failed to create background music generation task",
  },
  generate_dialogue: {
    purpose: "voiceover",
    defaultTags: ["dialogue", "voiceover"],
    defaultNamePrefix: "Dialogue",
    successMessage: "Dialogue generation task created",
    errorMessage: "Failed to create dialogue generation task",
  },
};

/**
 * 构建 audioMeta 对象
 */
function buildAudioMeta(
  functionName: string,
  params: Record<string, unknown>
): AssetMeta {
  switch (functionName) {
    case "generate_sound_effect": {
      const soundEffect: AudioMeta["soundEffect"] = {
        isLoopable: params.is_loopable as boolean | undefined,
      };
      if (params.duration !== undefined) {
        (soundEffect as Record<string, unknown>).duration = Math.min(
          Math.max(params.duration as number, 0.5),
          22
        );
      }
      return {
        audio: {
          purpose: "sound_effect",
          description: params.prompt as string,
          soundEffect,
        },
      };
    }
    case "generate_bgm":
      return {
        audio: {
          purpose: "bgm",
          description: params.prompt as string,
          bgm: {
            genre: params.genre as string | undefined,
            mood: params.mood as string | undefined,
            hasVocals: !((params.instrumental as boolean) ?? true),
          },
        },
      };
    case "generate_dialogue":
      return {
        audio: {
          purpose: "voiceover",
          description: params.text as string,
          voiceover: {
            voiceId: params.voice_id as string,
            emotion: params.emotion as string | undefined,
            speakingRate: params.speed as number | undefined,
            pitch: params.pitch as number | undefined,
            transcript: params.text as string,
          },
        },
      };
    default:
      throw new Error(`Unknown audio function: ${functionName}`);
  }
}

/**
 * 统一的音频生成处理器
 */
export async function handleAudioGeneration(
  functionCall: FunctionCall,
  projectId: string
): Promise<FunctionExecutionResult> {
  const { name, parameters } = functionCall;
  const config = AUDIO_TYPE_CONFIGS[name];

  if (!config) {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: `Unknown audio generation function: ${name}`,
    };
  }

  try {
    // 获取通用字段
    const promptOrText = (parameters.prompt ?? parameters.text) as string;
    const tags = (parameters.tags as string[]) || config.defaultTags;
    let assetName = parameters.name as string | undefined;
    let successMessage = config.successMessage;

    const finalPromptOrText = promptOrText;

    // 特殊处理 generate_dialogue 的音色验证和名称生成
    let voiceDisplayName: string | undefined;
    if (name === "generate_dialogue") {
      const { isValidVoiceId, getVoiceDisplayName } = await import("@/lib/config/voices");
      const voiceId = parameters.voice_id as string;

      if (!isValidVoiceId(voiceId)) {
        return {
          functionCallId: functionCall.id,
          success: false,
          error: `Invalid voice ID: ${voiceId}, please use a system preset voice`,
        };
      }

      voiceDisplayName = getVoiceDisplayName(voiceId);
      if (!assetName) {
        assetName = `${config.defaultNamePrefix}-${voiceDisplayName}-${Date.now()}`;
      }
      successMessage = `Dialogue generation task created (voice: ${voiceDisplayName})`;
    } else {
      if (!assetName) {
        assetName = `${config.defaultNamePrefix}-${Date.now()}`;
      }
    }

    // 构建 audioMeta
    const audioMeta = buildAudioMeta(name, parameters);

    // 调用统一的创建函数
    const createResult = await createAudioAsset({
      projectId,
      name: assetName,
      prompt: finalPromptOrText,
      meta: audioMeta,
      tags,
    });

    if (createResult.success && createResult.data) {
      return {
        functionCallId: functionCall.id,
        success: true,
        data: {
          assetId: createResult.data.asset.id,
          jobId: createResult.data.jobId,
          message: successMessage,
        },
      };
    } else {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: createResult.error || config.errorMessage,
      };
    }
  } catch (error) {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate audio",
    };
  }
}
