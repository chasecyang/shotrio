"use server";

import db from "@/lib/db";
import { asset, exampleAsset, imageData, videoData } from "@/lib/db/schemas/project";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/auth-utils";

/**
 * 将资产标记为示例
 */
export async function markAssetAsExample(
  assetId: string,
  options: {
    order?: number;
    displayName?: string;
    description?: string;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireAdmin();

    // 验证资产存在且是图片或视频
    const assetData = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
    });

    if (!assetData) {
      return { success: false, error: "资产不存在" };
    }

    if (assetData.assetType !== "image" && assetData.assetType !== "video") {
      return { success: false, error: "只能标记图片或视频为示例" };
    }

    // 检查是否已经标记
    const existing = await db.query.exampleAsset.findFirst({
      where: eq(exampleAsset.assetId, assetId),
    });

    if (existing) {
      // 更新
      await db
        .update(exampleAsset)
        .set({
          order: options.order ?? existing.order,
          displayName: options.displayName ?? existing.displayName,
          description: options.description ?? existing.description,
        })
        .where(eq(exampleAsset.assetId, assetId));
    } else {
      // 创建
      await db.insert(exampleAsset).values({
        assetId,
        order: options.order ?? 0,
        displayName: options.displayName ?? null,
        description: options.description ?? null,
      });
    }

    return { success: true };
  } catch (error) {
    console.error("标记示例失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "标记失败",
    };
  }
}

/**
 * 取消资产的示例标记
 */
export async function unmarkAssetAsExample(assetId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireAdmin();
    await db.delete(exampleAsset).where(eq(exampleAsset.assetId, assetId));
    return { success: true };
  } catch (error) {
    console.error("取消示例标记失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "取消失败",
    };
  }
}

/**
 * 更新示例资产信息
 */
export async function updateExampleAssetInfo(
  assetId: string,
  data: {
    order?: number;
    displayName?: string;
    description?: string;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireAdmin();

    const existing = await db.query.exampleAsset.findFirst({
      where: eq(exampleAsset.assetId, assetId),
    });

    if (!existing) {
      return { success: false, error: "示例不存在" };
    }

    await db
      .update(exampleAsset)
      .set({
        ...(data.order !== undefined && { order: data.order }),
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.description !== undefined && { description: data.description }),
      })
      .where(eq(exampleAsset.assetId, assetId));

    return { success: true };
  } catch (error) {
    console.error("更新示例信息失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新失败",
    };
  }
}

/**
 * 获取所有示例资产（管理员用）
 */
export async function getAllExampleAssets(): Promise<{
  success: boolean;
  examples?: Array<{
    assetId: string;
    assetName: string;
    assetType: string;
    imageUrl: string | null;
    videoUrl: string | null;
    thumbnailUrl: string | null;
    order: number;
    displayName: string | null;
    description: string | null;
    creatorName: string | null;
    creatorEmail: string | null;
    projectTitle: string | null;
    createdAt: Date;
  }>;
  error?: string;
}> {
  try {
    await requireAdmin();

    const examples = await db.query.exampleAsset.findMany({
      orderBy: [desc(exampleAsset.order), desc(exampleAsset.createdAt)],
      with: {
        asset: {
          with: {
            imageDataList: true,
            videoDataList: true,
            user: true,
            project: true,
          },
        },
      },
    });

    return {
      success: true,
      examples: examples.map((ex) => {
        const assetData = ex.asset as any;
        const activeImage = assetData.imageDataList?.find((v: any) => v.isActive);
        const activeVideo = assetData.videoDataList?.find((v: any) => v.isActive);
        const user = assetData.user;
        const project = assetData.project;

        return {
          assetId: ex.assetId,
          assetName: assetData.name,
          assetType: assetData.assetType,
          imageUrl: activeImage?.imageUrl ?? null,
          videoUrl: activeVideo?.videoUrl ?? null,
          thumbnailUrl: activeImage?.thumbnailUrl ?? activeVideo?.thumbnailUrl ?? null,
          order: ex.order,
          displayName: ex.displayName,
          description: ex.description,
          creatorName: user?.name ?? null,
          creatorEmail: user?.email ?? null,
          projectTitle: project?.title ?? null,
          createdAt: ex.createdAt,
        };
      }),
    };
  } catch (error) {
    console.error("获取示例列表失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取失败",
    };
  }
}

/**
 * 获取资产列表供管理员浏览（所有用户的资产）
 */
export async function getAdminAssets(options: {
  assetType?: "image" | "video";
  search?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  assets?: Array<{
    id: string;
    name: string;
    assetType: string;
    imageUrl: string | null;
    videoUrl: string | null;
    thumbnailUrl: string | null;
    isExample: boolean;
    creatorName: string | null;
    creatorEmail: string | null;
    projectTitle: string | null;
    createdAt: Date;
  }>;
  error?: string;
}> {
  try {
    await requireAdmin();

    const conditions: any[] = [];

    // 只查询图片和视频资产
    conditions.push(or(eq(asset.assetType, "image"), eq(asset.assetType, "video")));

    if (options.assetType) {
      conditions.push(eq(asset.assetType, options.assetType));
    }

    if (options.search) {
      conditions.push(sql`${asset.name} ILIKE ${`%${options.search}%`}`);
    }

    if (options.userId) {
      conditions.push(eq(asset.userId, options.userId));
    }

    const assets = await db.query.asset.findMany({
      where: and(...conditions),
      orderBy: [desc(asset.createdAt)],
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
      with: {
        imageDataList: true,
        videoDataList: true,
        user: true,
        project: true,
        exampleAsset: true,
      },
    });

    return {
      success: true,
      assets: assets.map((a: any) => {
        const activeImage = a.imageDataList?.find((v: any) => v.isActive);
        const activeVideo = a.videoDataList?.find((v: any) => v.isActive);

        return {
          id: a.id,
          name: a.name,
          assetType: a.assetType,
          imageUrl: activeImage?.imageUrl ?? null,
          videoUrl: activeVideo?.videoUrl ?? null,
          thumbnailUrl: activeImage?.thumbnailUrl ?? activeVideo?.thumbnailUrl ?? null,
          isExample: !!a.exampleAsset,
          creatorName: a.user?.name ?? null,
          creatorEmail: a.user?.email ?? null,
          projectTitle: a.project?.title ?? null,
          createdAt: a.createdAt,
        };
      }),
    };
  } catch (error) {
    console.error("获取资产列表失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取失败",
    };
  }
}



