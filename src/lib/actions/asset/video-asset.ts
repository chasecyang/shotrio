"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { asset, videoData, job } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { AssetWithTags, AssetWithFullData } from "@/types/asset";
import { resolveAssetVersionId, safeRevalidatePath, insertAssetTags, fetchAssetWithTags } from "./utils";
import { deleteAssets } from "./base-crud";

/**
 * 创建视频生成任务
 */
export async function createVideoAsset(data: {
  projectId: string;
  name: string;
  prompt: string;
  generationConfig: import("@/types/asset").VideoGenerationConfig;
  order?: number;
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
    const videoDataId = randomUUID();
    const jobId = randomUUID();

    // 1. 创建 asset 基表记录
    await db.insert(asset).values({
      id: assetId,
      projectId: data.projectId,
      userId: session.user.id,
      name: data.name,
      assetType: "video",
      sourceType: "generated",
      order: data.order ?? null,
      usageCount: 0,
    });

    // 2. 查询源资产的激活版本，记录版本快照
    const configWithSnapshot = { ...data.generationConfig };
    const versionSnapshot: {
      start_image_version_id?: string;
      end_image_version_id?: string;
    } = {};

    // 起始帧版本快照
    if (
      configWithSnapshot.start_image_url &&
      !configWithSnapshot.start_image_url.startsWith("http")
    ) {
      const versionId = await resolveAssetVersionId(
        configWithSnapshot.start_image_url
      );
      if (versionId) {
        versionSnapshot.start_image_version_id = versionId;
      }
    }

    // 结束帧版本快照
    if (
      configWithSnapshot.end_image_url &&
      !configWithSnapshot.end_image_url.startsWith("http")
    ) {
      const versionId = await resolveAssetVersionId(
        configWithSnapshot.end_image_url
      );
      if (versionId) {
        versionSnapshot.end_image_version_id = versionId;
      }
    }

    // 将版本快照注入 config
    if (Object.keys(versionSnapshot).length > 0) {
      configWithSnapshot._versionSnapshot = versionSnapshot;
    }

    // 提取首尾帧 asset ID（用于重新生成时加载原始帧）
    const sourceAssetIds: string[] = [];
    if (
      configWithSnapshot.start_image_url &&
      !configWithSnapshot.start_image_url.startsWith("http")
    ) {
      sourceAssetIds.push(configWithSnapshot.start_image_url);
    }
    if (
      configWithSnapshot.end_image_url &&
      !configWithSnapshot.end_image_url.startsWith("http")
    ) {
      sourceAssetIds.push(configWithSnapshot.end_image_url);
    }

    // 3. 创建 videoData 记录（版本化结构，包含生成信息和版本快照）
    await db.insert(videoData).values({
      id: videoDataId,
      assetId,
      videoUrl: null,
      thumbnailUrl: null,
      duration: null,
      prompt: data.prompt,
      generationConfig: JSON.stringify(configWithSnapshot),
      sourceAssetIds: sourceAssetIds.length > 0 ? sourceAssetIds : null,
      isActive: true,
    });

    // 3. 插入标签
    await insertAssetTags(assetId, data.tags ?? []);

    // 5. 创建 job 任务（关联到版本）
    await db.insert(job).values({
      id: jobId,
      userId: session.user.id,
      projectId: data.projectId,
      type: "asset_video",
      status: "pending",
      assetId: assetId,
      videoDataId: videoDataId,
      inputData: {},
      progress: 0,
      currentStep: 0,
    });

    // 6. 查询创建的资产及其标签
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
    console.error("创建视频资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建视频资产失败",
    };
  }
}

/**
 * 查询视频资产
 */
export async function getVideoAssets(
  projectId: string,
  options?: {
    tags?: string[];
    orderBy?: "created" | "order";
  }
): Promise<{
  success: boolean;
  videos?: AssetWithFullData[];
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const { getProjectAssets } = await import("./queries");

    const videos = await getProjectAssets({
      projectId,
      assetType: "video",
      tagFilters: options?.tags,
      orderBy: options?.orderBy,
    });

    return { success: true, videos };
  } catch (error) {
    console.error("查询视频资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "查询视频资产失败",
    };
  }
}

/**
 * 更新视频资产
 */
export async function updateVideoAsset(
  assetId: string,
  data: {
    name?: string;
    prompt?: string;
    order?: number;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证权限和类型
    const existingAsset = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
    });

    if (!existingAsset) {
      return { success: false, error: "视频资产不存在" };
    }

    if (existingAsset.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    if (existingAsset.assetType !== "video") {
      return { success: false, error: "不是视频资产" };
    }

    // 1. 更新基表
    const baseUpdateData: Record<string, unknown> = {};
    if (data.name !== undefined) baseUpdateData.name = data.name;
    if (data.order !== undefined) baseUpdateData.order = data.order;

    if (Object.keys(baseUpdateData).length > 0) {
      await db.update(asset).set(baseUpdateData).where(eq(asset.id, assetId));
    }

    // 2. 更新 videoData（如果更新 prompt）
    if (data.prompt !== undefined) {
      await db
        .update(videoData)
        .set({ prompt: data.prompt })
        .where(
          and(eq(videoData.assetId, assetId), eq(videoData.isActive, true))
        );
    }

    await safeRevalidatePath(existingAsset.projectId);

    return { success: true };
  } catch (error) {
    console.error("更新视频资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新视频资产失败",
    };
  }
}

/**
 * 删除视频资产
 */
export async function deleteVideoAssets(assetIds: string[]): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  // 直接复用通用的删除函数
  return deleteAssets(assetIds);
}
