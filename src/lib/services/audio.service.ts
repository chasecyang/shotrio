/**
 * 统一的音频生成服务接口
 *
 * 支持两种音频生成类型：
 * - 音效生成 (ElevenLabs Sound Effect V2)
 * - 背景音乐生成 (Suno Music)
 *
 * 通过环境变量 AUDIO_SERVICE_PROVIDER 控制使用哪个服务商
 * 默认值: "kie"
 */

import type {
  SoundEffectInput,
  SoundEffectOutput,
  SoundEffectOutputFormat,
  MusicGenerationInput,
  MusicGenerationOutput,
  SunoModel,
} from "@/lib/services/kie/audio";

// 重新导出类型供其他文件使用
export type {
  SoundEffectInput,
  SoundEffectOutput,
  SoundEffectOutputFormat,
  MusicGenerationInput,
  MusicGenerationOutput,
  SunoModel,
};

type AudioServiceProvider = "kie";

/**
 * 获取当前配置的音频服务提供商
 */
function getAudioServiceProvider(): AudioServiceProvider {
  const provider = process.env.AUDIO_SERVICE_PROVIDER?.toLowerCase() as AudioServiceProvider;

  // 目前只支持 kie
  if (provider !== "kie") {
    return "kie";
  }

  return provider;
}

/**
 * 生成音效
 *
 * 使用 ElevenLabs Sound Effect V2 生成音效
 * - 支持最长 22 秒的音效
 * - 48kHz 专业音频质量
 * - 可创建无缝循环音效
 *
 * 成本: $0.0012/次
 */
export async function generateSoundEffect(
  input: SoundEffectInput
): Promise<SoundEffectOutput> {
  const provider = getAudioServiceProvider();

  if (provider === "kie") {
    const { generateSoundEffect: kieGenerateSoundEffect } = await import(
      "@/lib/services/kie"
    );
    return kieGenerateSoundEffect(input);
  }

  // 默认使用 kie
  const { generateSoundEffect: kieGenerateSoundEffect } = await import(
    "@/lib/services/kie"
  );
  return kieGenerateSoundEffect(input);
}

/**
 * 生成背景音乐
 *
 * 使用 Suno 生成背景音乐
 * - 支持多种模型版本
 * - 自定义模式支持风格、标题设置
 * - 支持纯音乐或带人声
 *
 * 成本: $0.06/次
 */
export async function generateMusic(
  input: MusicGenerationInput
): Promise<MusicGenerationOutput> {
  const provider = getAudioServiceProvider();

  if (provider === "kie") {
    const { generateMusic: kieGenerateMusic } = await import(
      "@/lib/services/kie"
    );
    return kieGenerateMusic(input);
  }

  // 默认使用 kie
  const { generateMusic: kieGenerateMusic } = await import(
    "@/lib/services/kie"
  );
  return kieGenerateMusic(input);
}

/**
 * 等待音乐生成完成
 *
 * 轮询直到音乐生成完成或失败
 */
export async function waitForMusic(
  taskId: string,
  maxAttempts = 60,
  interval = 10000
): Promise<MusicGenerationOutput> {
  const provider = getAudioServiceProvider();

  if (provider === "kie") {
    const { waitForMusic: kieWaitForMusic } = await import(
      "@/lib/services/kie"
    );
    return kieWaitForMusic(taskId, maxAttempts, interval);
  }

  // 默认使用 kie
  const { waitForMusic: kieWaitForMusic } = await import("@/lib/services/kie");
  return kieWaitForMusic(taskId, maxAttempts, interval);
}
