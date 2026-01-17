"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { asset, job } from "@/lib/db/schemas/project";
import { eq, inArray, and } from "drizzle-orm";
import type {
  AssetTypeEnum,
  AssetWithTags,
  AssetWithFullData,
} from "@/types/asset";
import { enrichAssetWithFullData } from "@/lib/utils/asset-status";

/**
 * 获取单个资产详情（带标签，不含运行时状态）
 */
export async function getAsset(assetId: string): Promise<{
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

  try {
    const assetData = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
      with: {
        tags: true,
      },
    });

    if (!assetData) {
      return { success: false, error: "资产不存在" };
    }

    // 验证权限
    if (assetData.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    return {
      success: true,
      asset: assetData as AssetWithTags,
    };
  } catch (error) {
    console.error("获取资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取资产失败",
    };
  }
}

/**
 * 获取单个资产完整数据（带所有关联数据、运行时状态和扁平化属性）
 */
export async function getAssetWithFullData(assetId: string): Promise<{
  success: boolean;
  asset?: AssetWithFullData;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 查询资产及所有关联数据
    const assetData = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
      with: {
        tags: true,
        imageDataList: true,
        videoDataList: true,
        textData: true,
        audioData: true,
      },
    });

    if (!assetData) {
      return { success: false, error: "资产不存在" };
    }

    // 验证权限
    if (assetData.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    // 查询最新的 job（仅 generated 类型需要）
    let latestJob = null;
    if (assetData.sourceType === "generated") {
      const jobData = await db.query.job.findFirst({
        where: eq(job.assetId, assetId),
        orderBy: (job, { desc }) => [desc(job.createdAt)],
      });
      latestJob = jobData || null;
    }

    // 使用 enrichAssetWithFullData 构建完整数据
    const enrichedAsset = enrichAssetWithFullData(
      assetData as import("@/types/asset").Asset,
      assetData.tags,
      assetData.imageDataList,
      assetData.videoDataList,
      assetData.textData,
      assetData.audioData,
      latestJob as import("@/types/job").Job | null
    );

    return {
      success: true,
      asset: enrichedAsset,
    };
  } catch (error) {
    console.error("获取资产完整数据失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取资产完整数据失败",
    };
  }
}

/**
 * 批量获取资产（用于展示，返回基本信息 + 图片URL）
 */
export async function getAssetsByIds(assetIds: string[]): Promise<{
  success: boolean;
  assets?: Array<{
    id: string;
    name: string;
    assetType: AssetTypeEnum;
    displayUrl: string | null;
  }>;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  if (assetIds.length === 0) {
    return { success: true, assets: [] };
  }

  try {
    // 使用 relations 查询，包含图片数据
    const assetsData = await db.query.asset.findMany({
      where: and(inArray(asset.id, assetIds), eq(asset.userId, session.user.id)),
      with: {
        imageDataList: true,
      },
    });

    // 转换为返回格式，计算 displayUrl
    const assets = assetsData.map((a) => {
      // 找到激活的 imageData 版本
      const activeImageData = a.imageDataList?.find(
        (img: { isActive: boolean }) => img.isActive
      );
      return {
        id: a.id,
        name: a.name,
        assetType: a.assetType as AssetTypeEnum,
        displayUrl:
          activeImageData?.thumbnailUrl ?? activeImageData?.imageUrl ?? null,
      };
    });

    return {
      success: true,
      assets,
    };
  } catch (error) {
    console.error("批量获取资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "批量获取资产失败",
    };
  }
}

/**
 * 增加资产使用次数
 */
export async function incrementAssetUsage(assetId: string): Promise<void> {
  try {
    await db
      .update(asset)
      .set({
        usageCount: asset.usageCount + 1,
      })
      .where(eq(asset.id, assetId));
  } catch (error) {
    console.error("更新资产使用次数失败:", error);
  }
}
