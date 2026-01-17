"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { job } from "@/lib/db/schemas/project";
import { randomUUID } from "crypto";
import { getAssetWithFullData } from "./get-asset";
import { createAssetVersion } from "./version";

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
