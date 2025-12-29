"use server";

import db from "@/lib/db";
import { shotAsset, shot, asset } from "@/lib/db/schemas/project";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { randomUUID } from "crypto";
import type { NewShotAsset, ShotAssetWithAsset } from "@/types/project";
import { MAX_SHOT_ASSETS } from "@/lib/constants/shot-asset-labels";

/**
 * 添加分镜关联素材
 */
export async function addShotAsset(data: {
  shotId: string;
  assetId: string;
  label: string;
  order?: number;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证 shot 存在
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, data.shotId),
    });

    if (!shotData) {
      throw new Error("分镜不存在");
    }

    // 验证 asset 存在
    const assetData = await db.query.asset.findFirst({
      where: eq(asset.id, data.assetId),
    });

    if (!assetData) {
      throw new Error("素材不存在");
    }

    // 检查分镜关联素材数量是否已达上限
    const existingAssets = await db.query.shotAsset.findMany({
      where: eq(shotAsset.shotId, data.shotId),
      orderBy: [asc(shotAsset.order)],
    });

    if (existingAssets.length >= MAX_SHOT_ASSETS) {
      throw new Error(`每个分镜最多只能关联${MAX_SHOT_ASSETS}张图片`);
    }

    // 如果没有指定 order，自动分配到最后
    let order = data.order;
    if (order === undefined) {
      order = existingAssets.length > 0
        ? Math.max(...existingAssets.map((a) => a.order)) + 1
        : 0;
    }

    const newShotAsset: NewShotAsset = {
      id: randomUUID(),
      shotId: data.shotId,
      assetId: data.assetId,
      label: data.label,
      order,
    };

    const [created] = await db.insert(shotAsset).values(newShotAsset).returning();

    return { success: true, data: created };
  } catch (error) {
    console.error("添加分镜素材失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "添加失败",
    };
  }
}

/**
 * 更新分镜素材的 label
 */
export async function updateShotAssetLabel(data: {
  id: string;
  label: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const [updated] = await db
      .update(shotAsset)
      .set({ label: data.label })
      .where(eq(shotAsset.id, data.id))
      .returning();

    if (!updated) {
      throw new Error("分镜素材不存在");
    }

    return { success: true, data: updated };
  } catch (error) {
    console.error("更新 label 失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新失败",
    };
  }
}

/**
 * 移除分镜关联素材
 */
export async function removeShotAsset(id: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const [deleted] = await db
      .delete(shotAsset)
      .where(eq(shotAsset.id, id))
      .returning();

    if (!deleted) {
      throw new Error("分镜素材不存在");
    }

    return { success: true };
  } catch (error) {
    console.error("移除分镜素材失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "移除失败",
    };
  }
}

/**
 * 重新排序分镜关联素材
 */
export async function reorderShotAssets(data: {
  shotId: string;
  assetOrders: Array<{ id: string; order: number }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证 shot 存在
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, data.shotId),
    });

    if (!shotData) {
      throw new Error("分镜不存在");
    }

    // 使用事务批量更新
    await db.transaction(async (tx) => {
      for (const item of data.assetOrders) {
        await tx
          .update(shotAsset)
          .set({ order: item.order })
          .where(
            and(
              eq(shotAsset.id, item.id),
              eq(shotAsset.shotId, data.shotId)
            )
          );
      }
    });

    return { success: true };
  } catch (error) {
    console.error("重新排序失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "重新排序失败",
    };
  }
}

/**
 * 查询分镜的所有关联素材
 */
export async function getShotAssets(shotId: string): Promise<ShotAssetWithAsset[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const assets = await db.query.shotAsset.findMany({
      where: eq(shotAsset.shotId, shotId),
      with: {
        asset: true,
      },
      orderBy: [asc(shotAsset.order)],
    });

    return assets as ShotAssetWithAsset[];
  } catch (error) {
    console.error("查询分镜素材失败:", error);
    return [];
  }
}

/**
 * 批量添加分镜关联素材
 */
export async function batchAddShotAssets(data: {
  shotId: string;
  assets: Array<{
    assetId: string;
    label: string;
  }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证 shot 存在
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, data.shotId),
    });

    if (!shotData) {
      throw new Error("分镜不存在");
    }

    // 获取当前最大 order
    const existingAssets = await db.query.shotAsset.findMany({
      where: eq(shotAsset.shotId, data.shotId),
      orderBy: [asc(shotAsset.order)],
    });
    
    // 检查添加后是否超过上限
    if (existingAssets.length + data.assets.length > MAX_SHOT_ASSETS) {
      throw new Error(`每个分镜最多只能关联${MAX_SHOT_ASSETS}张图片`);
    }
    
    let nextOrder = existingAssets.length > 0
      ? Math.max(...existingAssets.map((a) => a.order)) + 1
      : 0;

    // 批量插入
    const newAssets: NewShotAsset[] = data.assets.map((item) => ({
      id: randomUUID(),
      shotId: data.shotId,
      assetId: item.assetId,
      label: item.label,
      order: nextOrder++,
    }));

    const created = await db.insert(shotAsset).values(newAssets).returning();

    return { success: true, data: created };
  } catch (error) {
    console.error("批量添加分镜素材失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "批量添加失败",
    };
  }
}

