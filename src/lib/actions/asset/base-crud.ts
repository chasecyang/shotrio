"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import {
  asset,
  imageData,
  videoData,
  textData,
  audioData,
} from "@/lib/db/schemas/project";
import { eq, inArray, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { AssetWithTags } from "@/types/asset";
import { safeRevalidatePath, insertAssetTags, fetchAssetWithTags } from "./utils";
import type { CreateAssetFullInput, UpdateAssetFullInput } from "./types";

/**
 * 内部函数：创建新资产（不需要session，由worker调用）
 *
 * 使用版本化结构：
 * - 基表 asset：共享字段
 * - imageData/videoData：包含版本和生成信息（合并了 generationInfo）
 * - textData/audioData：暂不做版本化
 *
 * @returns 返回 imageDataId 或 videoDataId 用于 job 关联
 */
export async function createAssetInternal(
  input: CreateAssetFullInput & { userId: string }
): Promise<{
  success: boolean;
  asset?: AssetWithTags;
  imageDataId?: string;
  videoDataId?: string;
  error?: string;
}> {
  try {
    const assetId = randomUUID();
    let imageDataId: string | undefined;
    let videoDataId: string | undefined;

    // 1. 插入基表 asset
    await db.insert(asset).values({
      id: assetId,
      projectId: input.projectId,
      userId: input.userId,
      name: input.name,
      assetType: input.assetType,
      sourceType: input.sourceType,
      meta: input.meta ? JSON.stringify(input.meta) : null,
      order: input.order ?? null,
      usageCount: 0,
    });

    // 2. 插入类型特定数据（版本化结构，包含生成信息）
    switch (input.assetType) {
      case "image": {
        // 创建 imageData 记录（带版本 ID 和生成信息）
        imageDataId = randomUUID();
        await db.insert(imageData).values({
          id: imageDataId,
          assetId,
          imageUrl: input.imageData?.imageUrl ?? null,
          thumbnailUrl: input.imageData?.thumbnailUrl ?? null,
          prompt: input.imageData?.prompt ?? null,
          seed: input.imageData?.seed ?? null,
          modelUsed: input.imageData?.modelUsed ?? null,
          generationConfig: input.imageData?.generationConfig ?? null,
          sourceAssetIds: input.imageData?.sourceAssetIds ?? null,
          isActive: true,
        });
        break;
      }
      case "video": {
        // 创建 videoData 记录（带版本 ID 和生成信息）
        videoDataId = randomUUID();
        await db.insert(videoData).values({
          id: videoDataId,
          assetId,
          videoUrl: input.videoData?.videoUrl ?? null,
          thumbnailUrl: input.videoData?.thumbnailUrl ?? null,
          duration: input.videoData?.duration ?? null,
          prompt: input.videoData?.prompt ?? null,
          seed: input.videoData?.seed ?? null,
          modelUsed: input.videoData?.modelUsed ?? null,
          generationConfig: input.videoData?.generationConfig ?? null,
          sourceAssetIds: input.videoData?.sourceAssetIds ?? null,
          isActive: true,
        });
        break;
      }
      case "text":
        if (input.textData) {
          await db.insert(textData).values({
            assetId,
            textContent: input.textData.textContent ?? null,
          });
        }
        break;
      case "audio":
        if (input.audioData) {
          await db.insert(audioData).values({
            assetId,
            audioUrl: input.audioData.audioUrl ?? null,
            duration: input.audioData.duration ?? null,
            format: input.audioData.format ?? null,
            sampleRate: input.audioData.sampleRate ?? null,
            bitrate: input.audioData.bitrate ?? null,
            channels: input.audioData.channels ?? null,
            prompt: input.audioData.prompt ?? null,
            seed: input.audioData.seed ?? null,
            modelUsed: input.audioData.modelUsed ?? null,
            generationConfig: input.audioData.generationConfig ?? null,
            sourceAssetIds: input.audioData.sourceAssetIds ?? null,
          });
        }
        break;
    }

    // 4. 插入标签
    await insertAssetTags(assetId, input.tags ?? []);

    // 5. 查询创建的资产及其标签
    const createdAsset = await fetchAssetWithTags(assetId);

    if (!createdAsset) {
      return { success: false, error: "创建资产后查询失败" };
    }

    await safeRevalidatePath(input.projectId);

    return {
      success: true,
      asset: createdAsset as AssetWithTags,
      imageDataId,
      videoDataId,
    };
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
export async function createAsset(input: CreateAssetFullInput): Promise<{
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
  input: UpdateAssetFullInput
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

    // 1. 更新基表
    const baseUpdateData: Record<string, unknown> = {};
    if (input.name !== undefined) baseUpdateData.name = input.name;
    if (input.meta !== undefined)
      baseUpdateData.meta = JSON.stringify(input.meta);
    if (input.order !== undefined) baseUpdateData.order = input.order;

    if (Object.keys(baseUpdateData).length > 0) {
      await db.update(asset).set(baseUpdateData).where(eq(asset.id, assetId));
    }

    // 2. 更新类型特定数据（更新激活版本，包含生成信息）
    if (input.imageData) {
      const imgUpdateData: Record<string, unknown> = {};
      if (input.imageData.imageUrl !== undefined)
        imgUpdateData.imageUrl = input.imageData.imageUrl;
      if (input.imageData.thumbnailUrl !== undefined)
        imgUpdateData.thumbnailUrl = input.imageData.thumbnailUrl;
      // 支持更新生成信息
      if (input.imageData.prompt !== undefined)
        imgUpdateData.prompt = input.imageData.prompt;
      if (input.imageData.seed !== undefined)
        imgUpdateData.seed = input.imageData.seed;
      if (input.imageData.modelUsed !== undefined)
        imgUpdateData.modelUsed = input.imageData.modelUsed;
      if (input.imageData.generationConfig !== undefined)
        imgUpdateData.generationConfig = input.imageData.generationConfig;
      if (input.imageData.sourceAssetIds !== undefined)
        imgUpdateData.sourceAssetIds = input.imageData.sourceAssetIds;

      if (Object.keys(imgUpdateData).length > 0) {
        // 更新激活版本
        await db
          .update(imageData)
          .set(imgUpdateData)
          .where(
            and(eq(imageData.assetId, assetId), eq(imageData.isActive, true))
          );
      }
    }

    if (input.videoData) {
      const vidUpdateData: Record<string, unknown> = {};
      if (input.videoData.videoUrl !== undefined)
        vidUpdateData.videoUrl = input.videoData.videoUrl;
      if (input.videoData.thumbnailUrl !== undefined)
        vidUpdateData.thumbnailUrl = input.videoData.thumbnailUrl;
      if (input.videoData.duration !== undefined)
        vidUpdateData.duration = input.videoData.duration;
      // 支持更新生成信息
      if (input.videoData.prompt !== undefined)
        vidUpdateData.prompt = input.videoData.prompt;
      if (input.videoData.seed !== undefined)
        vidUpdateData.seed = input.videoData.seed;
      if (input.videoData.modelUsed !== undefined)
        vidUpdateData.modelUsed = input.videoData.modelUsed;
      if (input.videoData.generationConfig !== undefined)
        vidUpdateData.generationConfig = input.videoData.generationConfig;
      if (input.videoData.sourceAssetIds !== undefined)
        vidUpdateData.sourceAssetIds = input.videoData.sourceAssetIds;

      if (Object.keys(vidUpdateData).length > 0) {
        // 更新激活版本
        await db
          .update(videoData)
          .set(vidUpdateData)
          .where(
            and(eq(videoData.assetId, assetId), eq(videoData.isActive, true))
          );
      }
    }

    if (input.textData) {
      const txtUpdateData: Record<string, unknown> = {};
      if (input.textData.textContent !== undefined)
        txtUpdateData.textContent = input.textData.textContent;

      if (Object.keys(txtUpdateData).length > 0) {
        await db
          .update(textData)
          .set(txtUpdateData)
          .where(eq(textData.assetId, assetId));
      }
    }

    if (input.audioData) {
      const audUpdateData: Record<string, unknown> = {};
      if (input.audioData.audioUrl !== undefined)
        audUpdateData.audioUrl = input.audioData.audioUrl;
      if (input.audioData.duration !== undefined)
        audUpdateData.duration = input.audioData.duration;
      if (input.audioData.format !== undefined)
        audUpdateData.format = input.audioData.format;
      if (input.audioData.sampleRate !== undefined)
        audUpdateData.sampleRate = input.audioData.sampleRate;
      if (input.audioData.bitrate !== undefined)
        audUpdateData.bitrate = input.audioData.bitrate;
      if (input.audioData.channels !== undefined)
        audUpdateData.channels = input.audioData.channels;
      // 生成信息
      if (input.audioData.prompt !== undefined)
        audUpdateData.prompt = input.audioData.prompt;
      if (input.audioData.seed !== undefined)
        audUpdateData.seed = input.audioData.seed;
      if (input.audioData.modelUsed !== undefined)
        audUpdateData.modelUsed = input.audioData.modelUsed;
      if (input.audioData.generationConfig !== undefined)
        audUpdateData.generationConfig = input.audioData.generationConfig;
      if (input.audioData.sourceAssetIds !== undefined)
        audUpdateData.sourceAssetIds = input.audioData.sourceAssetIds;

      if (Object.keys(audUpdateData).length > 0) {
        await db
          .update(audioData)
          .set(audUpdateData)
          .where(eq(audioData.assetId, assetId));
      }
    }

    await safeRevalidatePath(existingAsset.projectId);

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

    // 删除资产（扩展表会因为CASCADE自动删除）
    await db.delete(asset).where(eq(asset.id, assetId));

    await safeRevalidatePath(existingAsset.projectId);

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

    // 批量删除资产（扩展表会因为CASCADE自动删除）
    await db.delete(asset).where(inArray(asset.id, assetIds));

    // Revalidate路径
    if (projectId) {
      await safeRevalidatePath(projectId);
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
