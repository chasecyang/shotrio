"use server";

import db from "@/lib/db";
import { updateJobProgress, completeJob } from "@/lib/actions/job";
import { verifyProjectOwnership } from "../utils/validation";
import {
  generateSoundEffect,
  generateMusic,
  waitForMusic,
} from "@/lib/services/audio.service";
import { generateSpeech } from "@/lib/services/fal/speech";
import { uploadAudioToR2, AssetCategory } from "@/lib/storage/r2.service";
import { spendCredits, refundCredits } from "@/lib/actions/credits/spend";
import { CREDIT_COSTS } from "@/types/payment";
import type { Job, AudioGenerationResult } from "@/types/job";
import type { AudioMeta, AudioPurpose } from "@/types/asset";
import { asset, audioData } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";

/**
 * 处理音频生成任务
 * 支持音效生成（ElevenLabs）和背景音乐生成（Suno）
 */
export async function processAudioGeneration(
  jobData: Job,
  workerToken: string
): Promise<void> {
  const assetId = jobData.assetId;

  if (!assetId) {
    throw new Error("Job 缺少 assetId 关联");
  }

  try {
    await processAudioGenerationInternal(jobData, workerToken, assetId);
  } catch (error) {
    console.error(`[Worker] 音频生成任务失败:`, error);
    throw error;
  }
}

async function processAudioGenerationInternal(
  jobData: Job,
  workerToken: string,
  assetId: string
): Promise<void> {
  // 步骤1: 读取素材信息
  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 5,
      progressMessage: "读取素材信息...",
    },
    workerToken
  );

  // 查询 asset 获取基本信息
  const assetData = await db.query.asset.findFirst({
    where: eq(asset.id, assetId),
    with: {
      tags: true,
      audioDataList: true,
    },
  });

  if (!assetData) {
    throw new Error(`Asset ${assetId} 不存在`);
  }

  // 验证项目所有权
  if (assetData.projectId) {
    const hasAccess = await verifyProjectOwnership(
      assetData.projectId,
      jobData.userId
    );
    if (!hasAccess) {
      throw new Error("无权访问该项目");
    }
  }

  // 获取目标 audioData 版本
  // 如果 job 指定了 audioDataId，使用该版本；否则使用 active 版本
  let targetAudioData: (typeof assetData.audioDataList)[0] | undefined;
  const audioDataId = jobData.audioDataId;

  if (audioDataId) {
    // 使用指定的版本
    targetAudioData = assetData.audioDataList.find((ad: any) => ad.id === audioDataId);
    if (!targetAudioData) {
      throw new Error(`AudioData ${audioDataId} 不存在`);
    }
  } else {
    // 使用 active 版本（向后兼容）
    targetAudioData = assetData.audioDataList.find((ad: any) => ad.isActive);
  }

  if (!targetAudioData) {
    throw new Error("未找到音频数据版本");
  }

  // 解析 meta 获取音频配置
  let audioMeta: AudioMeta | null = null;
  if (assetData.meta) {
    try {
      const meta = JSON.parse(assetData.meta);
      audioMeta = meta.audio as AudioMeta;
    } catch {
      // ignore
    }
  }

  if (!audioMeta) {
    throw new Error("缺少音频配置（meta.audio）");
  }

  const purpose: AudioPurpose = audioMeta.purpose;

  // 从 audioData 读取 prompt
  const prompt = targetAudioData.prompt || audioMeta.description;

  if (!prompt) {
    throw new Error("缺少音频描述（prompt）");
  }

  const projectId = assetData.projectId;
  const assetName = assetData.name;

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 10,
      progressMessage: "准备生成音频...",
    },
    workerToken
  );

  // 步骤2: 根据类型计算积分并扣除
  let creditCost: number;
  let audioTypeLabel: string;

  if (purpose === "sound_effect") {
    creditCost = CREDIT_COSTS.SOUND_EFFECT_GENERATION;
    audioTypeLabel = "音效";
  } else if (purpose === "bgm") {
    creditCost = CREDIT_COSTS.MUSIC_GENERATION;
    audioTypeLabel = "背景音乐";
  } else {
    // voiceover: 按字符数计算，1 积分/100字 (成本$0.06/1000字, 利润率40%)
    const charCount = prompt.length;
    creditCost = Math.max(1, Math.ceil(charCount / 100));
    audioTypeLabel = "台词配音";
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 15,
      progressMessage: `检查积分余额（需要 ${creditCost} 积分）...`,
    },
    workerToken
  );

  const spendResult = await spendCredits({
    userId: jobData.userId,
    amount: creditCost,
    description: `descriptions.generation.audio`,
    metadata: {
      jobId: jobData.id,
      projectId,
      audioType: purpose,
      translationParams: { audioType: purpose },
    },
  });

  if (!spendResult.success) {
    throw new Error(spendResult.error || "积分不足");
  }

  const transactionId = spendResult.transactionId;

  // 步骤3: 调用对应的音频生成服务
  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 20,
      progressMessage: `正在生成${audioTypeLabel}...`,
    },
    workerToken
  );

  let audioUrl: string;
  let duration: number | undefined;
  let format: string;

  try {
    if (purpose === "sound_effect") {
      // 音效生成
      const soundEffectConfig = audioMeta.soundEffect || {};

      const result = await generateSoundEffect({
        text: prompt,
        loop: soundEffectConfig.isLoopable,
        duration_seconds: targetAudioData?.duration
          ? targetAudioData.duration / 1000
          : undefined,
        prompt_influence: 0.5,
        output_format: "mp3_44100_128",
      });

      audioUrl = result.audioUrl;
      format = result.format || "mp3";
      duration = result.duration;
    } else if (purpose === "bgm") {
      // 背景音乐生成
      const bgmConfig = audioMeta.bgm || {};

      // 构建音乐生成参数
      const musicResult = await generateMusic({
        prompt: prompt,
        customMode: !!bgmConfig.genre || !!bgmConfig.mood,
        instrumental: !bgmConfig.hasVocals,
        model: "V4_5",
        style: bgmConfig.genre || bgmConfig.mood,
        title: assetName,
      });

      // 等待音乐生成完成
      await updateJobProgress(
        {
          jobId: jobData.id,
          progress: 40,
          progressMessage: "音乐生成中，请耐心等待...",
        },
        workerToken
      );

      const completedMusic = await waitForMusic(musicResult.taskId);

      if (!completedMusic.audioUrl) {
        throw new Error("音乐生成完成但未返回音频URL");
      }

      audioUrl = completedMusic.audioUrl;
      duration = completedMusic.duration;
      format = "mp3";
    } else {
      // 台词配音生成（voiceover）
      const voiceoverConfig = audioMeta.voiceover || {};

      await updateJobProgress(
        {
          jobId: jobData.id,
          progress: 30,
          progressMessage: "正在合成语音...",
        },
        workerToken
      );

      const speechResult = await generateSpeech({
        prompt: prompt, // 台词文本
        voice_id: voiceoverConfig.voiceId || "female-shaonv",
        speed: voiceoverConfig.speakingRate,
        pitch: voiceoverConfig.pitch as number | undefined,
        emotion: voiceoverConfig.emotion as
          | "happy"
          | "sad"
          | "angry"
          | "fearful"
          | "disgusted"
          | "surprised"
          | "neutral"
          | undefined,
      });

      if (!speechResult.audio?.url) {
        throw new Error("语音合成失败：未返回音频URL");
      }

      audioUrl = speechResult.audio.url;
      duration = speechResult.duration_ms;
      format = "mp3";
    }
  } catch (error) {
    console.error("[Worker] 音频生成失败:", error);

    // 生成失败，退还积分
    if (transactionId) {
      await refundCredits({
        userId: jobData.userId,
        amount: creditCost,
        description: `descriptions.refund.audio_generation_failed`,
        metadata: {
          jobId: jobData.id,
          originalTransactionId: transactionId,
          reason: "generation_failed",
          translationParams: { audioType: purpose },
        },
      });
    }

    throw error;
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 60,
      progressMessage: `${audioTypeLabel}生成完成，正在上传...`,
    },
    workerToken
  );

  // 步骤4: 上传到 R2
  try {
    const uploadResult = await uploadAudioToR2(audioUrl, {
      userId: jobData.userId,
      category: AssetCategory.AUDIOS,
    });

    if (!uploadResult.success || !uploadResult.url) {
      // 上传失败，退还积分
      if (transactionId) {
        await refundCredits({
          userId: jobData.userId,
          amount: creditCost,
          description: `descriptions.refund.audio_upload_failed`,
          metadata: {
            jobId: jobData.id,
            originalTransactionId: transactionId,
            reason: "upload_failed",
            translationParams: { audioType: purpose },
          },
        });
      }

      throw new Error(`上传音频失败: ${uploadResult.error}`);
    }

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 80,
        progressMessage: "保存音频数据...",
      },
      workerToken
    );

    // 步骤5: 更新 audioData 记录
    // 根据类型选择模型名称
    let modelUsed: string;
    if (purpose === "sound_effect") {
      modelUsed = "elevenlabs/sound-effect-v2";
    } else if (purpose === "bgm") {
      modelUsed = "suno/v4.5";
    } else {
      modelUsed = "minimax/speech-2.6-turbo";
    }

    // 先将所有版本设为非 active
    await db
      .update(audioData)
      .set({ isActive: false })
      .where(eq(audioData.assetId, assetId));

    // 更新目标版本并设为 active
    await db
      .update(audioData)
      .set({
        audioUrl: uploadResult.url,
        duration: duration,
        format: format,
        modelUsed: modelUsed,
        isActive: true,
      })
      .where(eq(audioData.id, targetAudioData.id));

    // 更新 asset 的 updatedAt
    await db
      .update(asset)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(asset.id, assetId));

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 95,
        progressMessage: "完成，正在整理结果...",
      },
      workerToken
    );

    // 步骤6: 完成任务
    const resultData: AudioGenerationResult = {
      assetId: assetId,
      audioUrl: uploadResult.url,
      duration: duration,
      format: format,
      audioType: purpose, // "sound_effect" | "bgm" | "voiceover"
    };

    await completeJob(
      {
        jobId: jobData.id,
        resultData,
      },
      workerToken
    );
  } catch (error) {
    console.error(`上传音频失败:`, error);
    throw new Error(
      `上传音频失败: ${error instanceof Error ? error.message : "未知错误"}`
    );
  }
}
