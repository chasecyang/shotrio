"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import { audioData, videoData } from "@/lib/db/schemas/project";
import { createJob } from "../job";

interface RegenerateResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

/**
 * 重新生成视频资产
 */
export async function regenerateVideoAsset(
  assetId: string
): Promise<RegenerateResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 获取现有素材
    const { getAssetWithFullData } = await import("./get-asset");
    const assetResult = await getAssetWithFullData(assetId);

    if (!assetResult.success || !assetResult.asset) {
      return { success: false, error: assetResult.error || "素材不存在" };
    }

    const existingAsset = assetResult.asset;

    // 验证是否可以重新生成
    if (existingAsset.sourceType !== "generated") {
      return { success: false, error: "只能重新生成 AI 生成的素材" };
    }

    if (existingAsset.assetType !== "video") {
      return { success: false, error: "此方法仅支持视频素材" };
    }

    if (!existingAsset.prompt) {
      return { success: false, error: "缺少生成参数（prompt）" };
    }

    // 创建新版本
    const { createAssetVersion } = await import("./version");
    const versionResult = await createAssetVersion(assetId, {
      prompt: existingAsset.prompt,
      modelUsed: existingAsset.modelUsed || "seedance-1.5-pro",
      generationConfig: existingAsset.generationConfig || JSON.stringify({}),
      sourceAssetIds: existingAsset.sourceAssetIds || undefined,
      duration: existingAsset.duration || undefined,
    });

    if (!versionResult.success || !versionResult.versionId) {
      return { success: false, error: versionResult.error || "创建版本失败" };
    }

    // 创建视频生成任务（关联到新版本）
    const jobResult = await createJob({
      userId: session.user.id,
      projectId: existingAsset.projectId,
      type: "asset_video",
      assetId: assetId,
      videoDataId: versionResult.versionId,
      inputData: {},
    });

    if (!jobResult.success || !jobResult.jobId) {
      return { success: false, error: jobResult.error || "创建任务失败" };
    }

    return {
      success: true,
      jobId: jobResult.jobId,
    };
  } catch (error) {
    console.error("重新生成视频失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "重新生成失败",
    };
  }
}

/**
 * 重新生成音频资产
 */
export async function regenerateAudioAsset(
  assetId: string
): Promise<RegenerateResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 获取现有素材
    const { getAssetWithFullData } = await import("./get-asset");
    const assetResult = await getAssetWithFullData(assetId);

    if (!assetResult.success || !assetResult.asset) {
      return { success: false, error: assetResult.error || "素材不存在" };
    }

    const existingAsset = assetResult.asset;

    // 验证是否可以重新生成
    if (existingAsset.sourceType !== "generated") {
      return { success: false, error: "只能重新生成 AI 生成的素材" };
    }

    if (existingAsset.assetType !== "audio") {
      return { success: false, error: "此方法仅支持音频素材" };
    }

    if (!existingAsset.prompt) {
      return { success: false, error: "缺少生成参数（prompt）" };
    }

    // 创建新的音频数据版本
    const audioDataId = randomUUID();

    await db.insert(audioData).values({
      id: audioDataId,
      assetId: assetId,
      audioUrl: null,
      duration: null,
      format: null,
      sampleRate: null,
      bitrate: null,
      channels: null,
      prompt: existingAsset.prompt,
      seed: existingAsset.seed || null,
      modelUsed: existingAsset.modelUsed || null,
      generationConfig: existingAsset.generationConfig || null,
      sourceAssetIds: existingAsset.sourceAssetIds || null,
      waveformData: null,
      isActive: false, // Worker 会在成功后激活
      createdAt: new Date(),
    });

    // 创建音频生成任务
    const jobResult = await createJob({
      userId: session.user.id,
      projectId: existingAsset.projectId,
      type: "asset_audio",
      assetId: assetId,
      audioDataId: audioDataId,
      inputData: {},
    });

    if (!jobResult.success || !jobResult.jobId) {
      return { success: false, error: jobResult.error || "创建任务失败" };
    }

    return {
      success: true,
      jobId: jobResult.jobId,
    };
  } catch (error) {
    console.error("重新生成音频失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "重新生成失败",
    };
  }
}

/**
 * 统一的重新生成函数（根据资产类型路由）
 */
export async function regenerateAsset(
  assetId: string
): Promise<RegenerateResult> {
  try {
    // 获取资产类型
    const { getAssetWithFullData } = await import("./get-asset");
    const assetResult = await getAssetWithFullData(assetId);

    if (!assetResult.success || !assetResult.asset) {
      return { success: false, error: assetResult.error || "素材不存在" };
    }

    const asset = assetResult.asset;

    // 根据类型路由到对应的重新生成函数
    switch (asset.assetType) {
      case "image": {
        const { regenerateAssetImage } = await import("./generate-asset");
        return await regenerateAssetImage(assetId);
      }

      case "video":
        return await regenerateVideoAsset(assetId);

      case "audio":
        return await regenerateAudioAsset(assetId);

      default:
        return { success: false, error: "不支持的素材类型" };
    }
  } catch (error) {
    console.error("重新生成素材失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "重新生成失败",
    };
  }
}
