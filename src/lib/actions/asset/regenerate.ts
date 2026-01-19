"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { job } from "@/lib/db/schemas/project";
import { randomUUID } from "crypto";
import { getAssetWithFullData, getAssetsByIds } from "./get-asset";
import { createAssetVersion } from "./version";
import { resolveAssetVersionId } from "./utils";
import type { VideoGenerationConfig } from "@/types/asset";

/**
 * 重新生成视频（创建新版本）
 */
export async function regenerateVideoAsset(assetId: string): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 获取现有素材
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

    if (!existingAsset.prompt && !existingAsset.generationConfig) {
      return { success: false, error: "缺少生成参数" };
    }

    // 创建新版本
    const versionResult = await createAssetVersion(assetId, {
      prompt: existingAsset.prompt ?? undefined,
      modelUsed: existingAsset.modelUsed ?? undefined,
      generationConfig: existingAsset.generationConfig ?? undefined,
      sourceAssetIds: existingAsset.sourceAssetIds || undefined,
    });

    if (!versionResult.success || !versionResult.versionId) {
      return { success: false, error: versionResult.error || "创建版本失败" };
    }

    // 创建视频生成任务（关联到新版本）
    const jobId = randomUUID();
    await db.insert(job).values({
      id: jobId,
      userId: session.user.id,
      projectId: existingAsset.projectId,
      type: "asset_video",
      status: "pending",
      assetId: assetId,
      videoDataId: versionResult.versionId,
      inputData: {},
      progress: 0,
      currentStep: 0,
    });

    return {
      success: true,
      jobId,
    };
  } catch (error) {
    console.error("重新生成视频失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "重新生成视频失败",
    };
  }
}

/**
 * 重新生成视频（带参数编辑）
 */
export async function regenerateVideoAssetWithParams(input: {
  assetId: string;
  editPrompt: string;
  aspectRatio: "16:9" | "9:16";
  startImageAssetId: string;
  endImageAssetId?: string;
}): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 获取现有视频资产
    const assetResult = await getAssetWithFullData(input.assetId);

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

    // 获取起始帧和结束帧的图片 URL
    const frameAssetIds = input.endImageAssetId
      ? [input.startImageAssetId, input.endImageAssetId]
      : [input.startImageAssetId];

    const framesResult = await getAssetsByIds(frameAssetIds);
    if (!framesResult.success || !framesResult.assets) {
      return { success: false, error: "获取首尾帧失败" };
    }

    const startFrame = framesResult.assets.find(
      (a) => a.id === input.startImageAssetId
    );
    if (!startFrame || !startFrame.displayUrl) {
      return { success: false, error: "起始帧不存在或无效" };
    }

    const endFrame = input.endImageAssetId
      ? framesResult.assets.find((a) => a.id === input.endImageAssetId)
      : null;

    // 构建新的 VideoGenerationConfig
    const newConfig: VideoGenerationConfig = {
      prompt: input.editPrompt,
      start_image_url: startFrame.displayUrl,
      aspect_ratio: input.aspectRatio,
      type: "FIRST_AND_LAST_FRAMES_2_VIDEO",
    };

    if (endFrame && endFrame.displayUrl) {
      newConfig.end_image_url = endFrame.displayUrl;
    }

    // 记录版本快照
    const versionSnapshot: {
      start_image_version_id?: string;
      end_image_version_id?: string;
    } = {};

    const startVersionId = await resolveAssetVersionId(input.startImageAssetId);
    if (startVersionId) {
      versionSnapshot.start_image_version_id = startVersionId;
    }

    if (input.endImageAssetId) {
      const endVersionId = await resolveAssetVersionId(input.endImageAssetId);
      if (endVersionId) {
        versionSnapshot.end_image_version_id = endVersionId;
      }
    }

    if (Object.keys(versionSnapshot).length > 0) {
      newConfig._versionSnapshot = versionSnapshot;
    }

    // 创建新版本
    const versionResult = await createAssetVersion(input.assetId, {
      prompt: input.editPrompt,
      modelUsed: existingAsset.modelUsed ?? undefined,
      generationConfig: JSON.stringify(newConfig),
      sourceAssetIds: frameAssetIds,
    });

    if (!versionResult.success || !versionResult.versionId) {
      return { success: false, error: versionResult.error || "创建版本失败" };
    }

    // 创建视频生成任务
    const jobId = randomUUID();
    await db.insert(job).values({
      id: jobId,
      userId: session.user.id,
      projectId: existingAsset.projectId,
      type: "asset_video",
      status: "pending",
      assetId: input.assetId,
      videoDataId: versionResult.versionId,
      inputData: {},
      progress: 0,
      currentStep: 0,
    });

    return {
      success: true,
      jobId,
    };
  } catch (error) {
    console.error("重新生成视频失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "重新生成视频失败",
    };
  }
}
