"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { asset, assetTag } from "@/lib/db/schemas/project";
import { eq, inArray, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import type {
  CreateAssetInput,
  UpdateAssetInput,
  AssetWithTags,
} from "@/types/asset";
import { revalidatePath } from "next/cache";

/**
 * 内部函数：创建新资产（不需要session，由worker调用）
 */
export async function createAssetInternal(
  input: CreateAssetInput & { userId: string }
): Promise<{
  success: boolean;
  asset?: AssetWithTags;
  error?: string;
}> {
  try {
    const assetId = randomUUID();

    // 插入资产（imageUrl 可为空，表示正在生成中）
    await db.insert(asset).values({
      id: assetId,
      projectId: input.projectId,
      userId: input.userId,
      name: input.name,
      imageUrl: input.imageUrl || null,
      thumbnailUrl: input.thumbnailUrl || null,
      prompt: input.prompt || null,
      seed: input.seed || null,
      modelUsed: input.modelUsed || null,
      sourceAssetIds: input.sourceAssetIds || null,
      derivationType: input.derivationType || null,
      meta: input.meta ? JSON.stringify(input.meta) : null,
      usageCount: 0,
    });

    // 插入标签
    if (input.tags && input.tags.length > 0) {
      await db.insert(assetTag).values(
        input.tags.map(tagValue => ({
          id: randomUUID(),
          assetId,
          tagValue,
        }))
      );
    }

    // 查询创建的资产及其标签
    const createdAsset = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
      with: {
        tags: true,
      },
    });

    if (!createdAsset) {
      return { success: false, error: "创建资产后查询失败" };
    }

    // 在worker环境中，revalidatePath可能会失败，需要安全处理
    try {
      revalidatePath(`/[lang]/projects/${input.projectId}`, "page");
    } catch {
      // Worker环境中可能无法revalidate，忽略错误
      console.log("无法revalidate路径（worker环境）");
    }

    return { success: true, asset: createdAsset as AssetWithTags };
  } catch (error) {
    console.error("创建资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建资产失败",
    };
  }
}

/**
 * 创建新资产（需要session）
 */
export async function createAsset(input: CreateAssetInput): Promise<{
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

  return createAssetInternal({ ...input, userId: session.user.id });
}

/**
 * 更新资产
 */
export async function updateAsset(
  assetId: string,
  input: UpdateAssetInput
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
    // 验证权限
    const existingAsset = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
    });

    if (!existingAsset) {
      return { success: false, error: "资产不存在" };
    }

    if (existingAsset.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    // 更新资产
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.imageUrl !== undefined) updateData.imageUrl = input.imageUrl;
    if (input.thumbnailUrl !== undefined) updateData.thumbnailUrl = input.thumbnailUrl;
    if (input.prompt !== undefined) updateData.prompt = input.prompt;
    if (input.seed !== undefined) updateData.seed = input.seed;
    if (input.modelUsed !== undefined) updateData.modelUsed = input.modelUsed;
    if (input.meta !== undefined) updateData.meta = JSON.stringify(input.meta);

    if (Object.keys(updateData).length > 0) {
      await db
        .update(asset)
        .set(updateData)
        .where(eq(asset.id, assetId));
    }

    revalidatePath(`/[lang]/projects/${existingAsset.projectId}`, "page");

    return { success: true };
  } catch (error) {
    console.error("更新资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新资产失败",
    };
  }
}

/**
 * 删除资产
 */
export async function deleteAsset(assetId: string): Promise<{
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
    // 验证权限
    const existingAsset = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
    });

    if (!existingAsset) {
      return { success: false, error: "资产不存在" };
    }

    if (existingAsset.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    // 删除资产（标签会因为CASCADE自动删除）
    await db.delete(asset).where(eq(asset.id, assetId));

    revalidatePath(`/[lang]/projects/${existingAsset.projectId}`, "page");

    return { success: true };
  } catch (error) {
    console.error("删除资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除资产失败",
    };
  }
}

/**
 * 批量删除资产
 */
export async function deleteAssets(assetIds: string[]): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  if (!assetIds || assetIds.length === 0) {
    return { success: false, error: "未选择要删除的素材" };
  }

  try {
    // 验证权限：确保所有素材都属于当前用户
    const existingAssets = await db.query.asset.findMany({
      where: inArray(asset.id, assetIds),
    });

    if (existingAssets.length === 0) {
      return { success: false, error: "未找到要删除的素材" };
    }

    // 检查权限
    const unauthorizedAssets = existingAssets.filter(
      (a) => a.userId !== session.user.id
    );
    if (unauthorizedAssets.length > 0) {
      return { success: false, error: "无权限删除部分素材" };
    }

    // 获取项目ID用于revalidate（假设所有素材属于同一项目）
    const projectId = existingAssets[0]?.projectId;

    // 批量删除资产（标签会因为CASCADE自动删除）
    await db.delete(asset).where(inArray(asset.id, assetIds));

    // Revalidate路径
    if (projectId) {
      revalidatePath(`/[lang]/projects/${projectId}`, "page");
    }

    return { success: true, deletedCount: existingAssets.length };
  } catch (error) {
    console.error("批量删除资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "批量删除资产失败",
    };
  }
}

/**
 * 获取单个资产详情（带标签）
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
        sourceAsset: true,
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
 * 批量获取资产（仅获取基本信息，用于展示）
 */
export async function getAssetsByIds(assetIds: string[]): Promise<{
  success: boolean;
  assets?: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    thumbnailUrl: string | null;
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
    const assetsData = await db.query.asset.findMany({
      where: and(
        inArray(asset.id, assetIds),
        eq(asset.userId, session.user.id)
      ),
      columns: {
        id: true,
        name: true,
        imageUrl: true,
        thumbnailUrl: true,
      },
    });

    return {
      success: true,
      assets: assetsData,
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

