"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { asset, assetTag } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { CreateAssetTagInput } from "@/types/asset";
import { revalidatePath } from "next/cache";

/**
 * 为资产添加标签
 */
export async function addAssetTag(input: CreateAssetTagInput): Promise<{
  success: boolean;
  tagId?: string;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证资产权限
    const assetData = await db.query.asset.findFirst({
      where: eq(asset.id, input.assetId),
    });

    if (!assetData) {
      return { success: false, error: "资产不存在" };
    }

    if (assetData.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    // 检查标签是否已存在
    const existingTag = await db.query.assetTag.findFirst({
      where: and(
        eq(assetTag.assetId, input.assetId),
        eq(assetTag.tagValue, input.tagValue)
      ),
    });

    if (existingTag) {
      return { success: true, tagId: existingTag.id }; // 标签已存在，返回成功
    }

    // 创建新标签
    const tagId = randomUUID();
    await db.insert(assetTag).values({
      id: tagId,
      assetId: input.assetId,
      tagValue: input.tagValue,
    });

    revalidatePath(`/[lang]/projects/${assetData.projectId}`, "page");

    return { success: true, tagId };
  } catch (error) {
    console.error("添加标签失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "添加标签失败",
    };
  }
}

/**
 * 批量添加标签
 */
export async function addAssetTags(
  assetId: string,
  tags: string[]  // 简化为字符串数组
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
    // 验证资产权限
    const assetData = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
    });

    if (!assetData) {
      return { success: false, error: "资产不存在" };
    }

    if (assetData.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    // 获取已存在的标签
    const existingTags = await db.query.assetTag.findMany({
      where: eq(assetTag.assetId, assetId),
    });

    const existingTagValues = new Set(
      existingTags.map(t => t.tagValue)
    );

    // 过滤出需要添加的新标签
    const newTags = tags.filter(
      tag => !existingTagValues.has(tag)
    );

    if (newTags.length > 0) {
      await db.insert(assetTag).values(
        newTags.map(tagValue => ({
          id: randomUUID(),
          assetId,
          tagValue,
        }))
      );
    }

    revalidatePath(`/[lang]/projects/${assetData.projectId}`, "page");

    return { success: true };
  } catch (error) {
    console.error("批量添加标签失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "批量添加标签失败",
    };
  }
}

/**
 * 删除标签
 */
export async function removeAssetTag(tagId: string): Promise<{
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
    const tagData = await db.query.assetTag.findFirst({
      where: eq(assetTag.id, tagId),
      with: {
        asset: true,
      },
    });

    if (!tagData || !tagData.asset) {
      return { success: false, error: "标签不存在" };
    }

    if ((tagData.asset as any).userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    // 删除标签
    await db.delete(assetTag).where(eq(assetTag.id, tagId));

    revalidatePath(`/[lang]/projects/${(tagData.asset as any).projectId}`, "page");

    return { success: true };
  } catch (error) {
    console.error("删除标签失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除标签失败",
    };
  }
}

/**
 * 删除资产的指定标签值的所有标签
 */
export async function removeAssetTagsByValue(
  assetId: string,
  tagValue: string
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
    // 验证资产权限
    const assetData = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
    });

    if (!assetData) {
      return { success: false, error: "资产不存在" };
    }

    if (assetData.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    // 删除指定值的所有标签
    await db.delete(assetTag).where(
      and(
        eq(assetTag.assetId, assetId),
        eq(assetTag.tagValue, tagValue)
      )
    );

    revalidatePath(`/[lang]/projects/${assetData.projectId}`, "page");

    return { success: true };
  } catch (error) {
    console.error("删除标签失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除标签失败",
    };
  }
}

/**
 * 替换资产的所有标签
 */
export async function replaceAssetTags(
  assetId: string,
  newTagValues: string[]
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
    // 验证资产权限
    const assetData = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
    });

    if (!assetData) {
      return { success: false, error: "资产不存在" };
    }

    if (assetData.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    // 使用事务：先删除旧标签，再添加新标签
    await db.transaction(async (tx) => {
      // 删除所有旧标签
      await tx.delete(assetTag).where(
        eq(assetTag.assetId, assetId)
      );

      // 添加新标签
      if (newTagValues.length > 0) {
        await tx.insert(assetTag).values(
          newTagValues.map(tagValue => ({
            id: randomUUID(),
            assetId,
            tagValue,
          }))
        );
      }
    });

    revalidatePath(`/[lang]/projects/${assetData.projectId}`, "page");

    return { success: true };
  } catch (error) {
    console.error("替换标签失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "替换标签失败",
    };
  }
}

