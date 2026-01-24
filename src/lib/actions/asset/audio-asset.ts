"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { asset, audioData, job } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { AssetMeta, AssetWithTags } from "@/types/asset";
import { safeRevalidatePath, insertAssetTags, fetchAssetWithTags } from "./utils";
import { createAssetInternal } from "./base-crud";

/**
 * 创建音频生成任务
 */
export async function createAudioAsset(data: {
  projectId: string;
  name: string;
  prompt?: string;
  sourceAssetIds?: string[];
  meta?: AssetMeta;
  tags?: string[];
}): Promise<{
  success: boolean;
  data?: { asset: AssetWithTags; jobId: string };
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const assetId = randomUUID();
    const audioDataId = randomUUID();
    const jobId = randomUUID();

    // 1. 创建 asset 基表记录
    await db.insert(asset).values({
      id: assetId,
      projectId: data.projectId,
      userId: session.user.id,
      name: data.name,
      assetType: "audio",
      sourceType: "generated",
      meta: data.meta ? JSON.stringify(data.meta) : null,
      usageCount: 0,
    });

    // 2. 创建 audioData 记录（包含生成信息，初始音频为空，worker 完成后更新）
    await db.insert(audioData).values({
      id: audioDataId,
      assetId,
      audioUrl: null,
      duration: null,
      prompt: data.prompt ?? null,
      sourceAssetIds: data.sourceAssetIds ?? null,
    });

    // 3. 插入标签
    await insertAssetTags(assetId, data.tags ?? []);

    // 4. 创建 job 任务
    await db.insert(job).values({
      id: jobId,
      userId: session.user.id,
      projectId: data.projectId,
      type: "asset_audio",
      status: "pending",
      assetId: assetId,
      inputData: {},
      progress: 0,
      currentStep: 0,
    });

    // 5. 查询创建的资产及其标签
    const createdAsset = await fetchAssetWithTags(assetId);

    if (!createdAsset) {
      return { success: false, error: "创建资产后查询失败" };
    }

    await safeRevalidatePath(data.projectId);

    return {
      success: true,
      data: {
        asset: createdAsset as AssetWithTags,
        jobId,
      },
    };
  } catch (error) {
    console.error("创建音频资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建音频资产失败",
    };
  }
}

/**
 * 上传音频资产（用户上传，非 AI 生成）
 */
export async function uploadAudioAsset(data: {
  projectId: string;
  name: string;
  audioUrl: string;
  duration?: number;
  format?: string;
  sampleRate?: number;
  bitrate?: number;
  channels?: number;
  meta?: AssetMeta;
  tags?: string[];
}): Promise<{
  success: boolean;
  asset?: AssetWithTags;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  return createAssetInternal({
    projectId: data.projectId,
    userId: session.user.id,
    name: data.name,
    assetType: "audio",
    sourceType: "uploaded",
    meta: data.meta,
    tags: data.tags,
    audioData: {
      audioUrl: data.audioUrl,
      duration: data.duration,
      format: data.format,
      sampleRate: data.sampleRate,
      bitrate: data.bitrate,
      channels: data.channels,
    },
  });
}
