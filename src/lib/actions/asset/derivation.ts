"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { asset, assetTag } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { CreateDerivedAssetInput } from "@/types/asset";
import { revalidatePath } from "next/cache";

/**
 * 创建派生资产（从现有资产派生）
 */
export async function createDerivedAsset(
  input: CreateDerivedAssetInput
): Promise<{
  success: boolean;
  assetId?: string;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证源资产存在
    const sourceAsset = await db.query.asset.findFirst({
      where: eq(asset.id, input.sourceAssetId),
    });

    if (!sourceAsset) {
      return { success: false, error: "源资产不存在" };
    }

    if (sourceAsset.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    const assetId = randomUUID();

    // 合并meta数据（如果有editParams，添加到meta中）
    const metaData = input.meta || {};
    if (input.editParams) {
      metaData.editParams = input.editParams;
    }

    // 插入派生资产
    await db.insert(asset).values({
      id: assetId,
      projectId: input.projectId,
      userId: session.user.id,
      name: input.name,
      imageUrl: input.imageUrl,
      thumbnailUrl: input.thumbnailUrl || null,
      prompt: input.prompt || null,
      seed: input.seed || null,
      modelUsed: input.modelUsed || null,
      sourceAssetId: input.sourceAssetId,
      derivationType: input.derivationType,
      meta: Object.keys(metaData).length > 0 ? JSON.stringify(metaData) : null,
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

    // 增加源资产的使用计数
    await db
      .update(asset)
      .set({
        usageCount: sourceAsset.usageCount + 1,
      })
      .where(eq(asset.id, input.sourceAssetId));

    revalidatePath(`/[lang]/projects/${input.projectId}`, "page");

    return { success: true, assetId };
  } catch (error) {
    console.error("创建派生资产失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建派生资产失败",
    };
  }
}

/**
 * 复制资产的标签到另一个资产
 */
export async function copyAssetTags(
  sourceAssetId: string,
  targetAssetId: string,
  excludeTagValues?: string[]
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
    // 验证两个资产都存在且有权限
    const [sourceAsset, targetAsset] = await Promise.all([
      db.query.asset.findFirst({
        where: eq(asset.id, sourceAssetId),
        with: { tags: true },
      }),
      db.query.asset.findFirst({
        where: eq(asset.id, targetAssetId),
      }),
    ]);

    if (!sourceAsset || !targetAsset) {
      return { success: false, error: "资产不存在" };
    }

    if (
      sourceAsset.userId !== session.user.id ||
      targetAsset.userId !== session.user.id
    ) {
      return { success: false, error: "无权限" };
    }

    // 过滤要复制的标签
    const tagsToCopy = excludeTagValues
      ? sourceAsset.tags.filter(tag => !excludeTagValues.includes(tag.tagValue))
      : sourceAsset.tags;

    if (tagsToCopy.length > 0) {
      // 获取目标资产已有的标签
      const existingTags = await db.query.assetTag.findMany({
        where: eq(assetTag.assetId, targetAssetId),
      });

      const existingTagValues = new Set(
        existingTags.map(t => t.tagValue)
      );

      // 过滤出需要添加的新标签
      const newTags = tagsToCopy.filter(
        tag => !existingTagValues.has(tag.tagValue)
      );

      if (newTags.length > 0) {
        await db.insert(assetTag).values(
          newTags.map(tag => ({
            id: randomUUID(),
            assetId: targetAssetId,
            tagValue: tag.tagValue,
          }))
        );
      }
    }

    revalidatePath(`/[lang]/projects/${targetAsset.projectId}`, "page");

    return { success: true };
  } catch (error) {
    console.error("复制标签失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "复制标签失败",
    };
  }
}

