"use server";

import db from "@/lib/db";
import { asset, assetTag } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

/**
 * 查询资产的激活版本 ID
 * 用于在创建任务时记录源资产的版本快照，确保 Worker 执行时使用提交时的版本
 *
 * @param assetId 资产 ID
 * @returns 激活版本的 imageData.id，如果不存在返回 null
 */
export async function resolveAssetVersionId(
  assetId: string
): Promise<string | null> {
  const imageAsset = await db.query.asset.findFirst({
    where: eq(asset.id, assetId),
    with: {
      imageDataList: true,
    },
  });

  const activeImageData = imageAsset?.imageDataList?.find(
    (img: { id: string; isActive: boolean }) => img.isActive
  );

  return activeImageData?.id ?? null;
}

/**
 * 安全的 revalidatePath 封装
 * 在 worker 环境中可能会失败，使用 try-catch 安全处理
 */
export async function safeRevalidatePath(projectId: string): Promise<void> {
  try {
    revalidatePath(`/[lang]/projects/${projectId}`, "page");
  } catch {
    // worker 环境中无法 revalidate
  }
}

/**
 * 插入资产标签
 */
export async function insertAssetTags(assetId: string, tags: string[]): Promise<void> {
  if (!tags || tags.length === 0) return;

  await db.insert(assetTag).values(
    tags.map((tagValue) => ({
      id: randomUUID(),
      assetId,
      tagValue,
    }))
  );
}

/**
 * 查询资产及其标签
 */
export async function fetchAssetWithTags(assetId: string) {
  return db.query.asset.findFirst({
    where: eq(asset.id, assetId),
    with: {
      tags: true,
    },
  });
}
