"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { asset, imageData, videoData } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import type {
  CreateImageDataInput,
  CreateVideoDataInput,
} from "@/types/asset";
import { safeRevalidatePath } from "./utils";

type VersionableAssetType = "image" | "video";

async function deactivateAllVersions(assetId: string, assetType: VersionableAssetType) {
  if (assetType === "image") {
    await db.update(imageData).set({ isActive: false }).where(eq(imageData.assetId, assetId));
  } else {
    await db.update(videoData).set({ isActive: false }).where(eq(videoData.assetId, assetId));
  }
}

async function activateVersion(versionId: string, assetType: VersionableAssetType) {
  if (assetType === "image") {
    await db.update(imageData).set({ isActive: true }).where(eq(imageData.id, versionId));
  } else {
    await db.update(videoData).set({ isActive: true }).where(eq(videoData.id, versionId));
  }
}

async function deleteVersion(versionId: string, assetType: VersionableAssetType) {
  if (assetType === "image") {
    await db.delete(imageData).where(eq(imageData.id, versionId));
  } else {
    await db.delete(videoData).where(eq(videoData.id, versionId));
  }
}

async function findVersion(versionId: string, assetId: string, assetType: VersionableAssetType) {
  if (assetType === "image") {
    return db.query.imageData.findFirst({
      where: and(eq(imageData.id, versionId), eq(imageData.assetId, assetId)),
    });
  } else {
    return db.query.videoData.findFirst({
      where: and(eq(videoData.id, versionId), eq(videoData.assetId, assetId)),
    });
  }
}

async function findOtherVersions(assetId: string, assetType: VersionableAssetType) {
  if (assetType === "image") {
    return db.query.imageData.findMany({
      where: and(eq(imageData.assetId, assetId), eq(imageData.isActive, false)),
      orderBy: (data, { desc }) => [desc(data.createdAt)],
      limit: 1,
    });
  } else {
    return db.query.videoData.findMany({
      where: and(eq(videoData.assetId, assetId), eq(videoData.isActive, false)),
      orderBy: (data, { desc }) => [desc(data.createdAt)],
      limit: 1,
    });
  }
}

/**
 * 创建新版本（用于重新生成功能）
 */
export async function createAssetVersion(
  assetId: string,
  input:
    | Omit<CreateImageDataInput, "assetId">
    | Omit<CreateVideoDataInput, "assetId">,
  options?: { activateImmediately?: boolean }
): Promise<{
  success: boolean;
  versionId?: string;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const existingAsset = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
    });

    if (!existingAsset) {
      return { success: false, error: "资产不存在" };
    }

    if (existingAsset.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    const versionId = randomUUID();
    const shouldActivate = options?.activateImmediately ?? false;

    if (existingAsset.assetType === "image") {
      const imgInput = input as Omit<CreateImageDataInput, "assetId">;

      if (shouldActivate) {
        await deactivateAllVersions(assetId, "image");
      }

      await db.insert(imageData).values({
        id: versionId,
        assetId,
        imageUrl: imgInput.imageUrl ?? null,
        thumbnailUrl: imgInput.thumbnailUrl ?? null,
        prompt: imgInput.prompt ?? null,
        seed: imgInput.seed ?? null,
        modelUsed: imgInput.modelUsed ?? null,
        generationConfig: imgInput.generationConfig ?? null,
        sourceAssetIds: imgInput.sourceAssetIds ?? null,
        isActive: shouldActivate,
      });
    } else if (existingAsset.assetType === "video") {
      const vidInput = input as Omit<CreateVideoDataInput, "assetId">;

      if (shouldActivate) {
        await deactivateAllVersions(assetId, "video");
      }

      await db.insert(videoData).values({
        id: versionId,
        assetId,
        videoUrl: vidInput.videoUrl ?? null,
        thumbnailUrl: vidInput.thumbnailUrl ?? null,
        duration: vidInput.duration ?? null,
        prompt: vidInput.prompt ?? null,
        seed: vidInput.seed ?? null,
        modelUsed: vidInput.modelUsed ?? null,
        generationConfig: vidInput.generationConfig ?? null,
        sourceAssetIds: vidInput.sourceAssetIds ?? null,
        isActive: shouldActivate,
      });
    } else {
      return { success: false, error: "该资产类型不支持版本化" };
    }

    await safeRevalidatePath(existingAsset.projectId);

    return { success: true, versionId };
  } catch (error) {
    console.error("创建版本失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建版本失败",
    };
  }
}

/**
 * 设置激活版本
 */
export async function setActiveVersion(
  assetId: string,
  versionId: string
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
    const existingAsset = await db.query.asset.findFirst({
      where: eq(asset.id, assetId),
    });

    if (!existingAsset) {
      return { success: false, error: "资产不存在" };
    }

    if (existingAsset.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    const assetType = existingAsset.assetType as VersionableAssetType;

    if (assetType !== "image" && assetType !== "video") {
      return { success: false, error: "该资产类型不支持版本化" };
    }

    const version = await findVersion(versionId, assetId, assetType);

    if (!version) {
      return { success: false, error: "版本不存在" };
    }

    await deactivateAllVersions(assetId, assetType);
    await activateVersion(versionId, assetType);

    await safeRevalidatePath(existingAsset.projectId);

    return { success: true };
  } catch (error) {
    console.error("设置激活版本失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "设置激活版本失败",
    };
  }
}

/**
 * 删除版本
 */
export async function deleteAssetVersion(versionId: string): Promise<{
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
    // 先尝试在 imageData 中查找
    const imageDataVersion = await db.query.imageData.findFirst({
      where: eq(imageData.id, versionId),
    });

    let assetType: VersionableAssetType = "image";
    let version: { id: string; assetId: string; isActive: boolean } | null = null;

    if (imageDataVersion) {
      version = imageDataVersion;
    } else {
      const videoDataVersion = await db.query.videoData.findFirst({
        where: eq(videoData.id, versionId),
      });
      if (videoDataVersion) {
        version = videoDataVersion;
        assetType = "video";
      }
    }

    if (!version) {
      return { success: false, error: "版本不存在" };
    }

    const existingAsset = await db.query.asset.findFirst({
      where: eq(asset.id, version.assetId),
    });

    if (!existingAsset || existingAsset.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    if (version.isActive) {
      const otherVersions = await findOtherVersions(version.assetId, assetType);

      if (otherVersions.length === 0) {
        return { success: false, error: "无法删除唯一版本" };
      }

      await activateVersion(otherVersions[0].id, assetType);
    }

    await deleteVersion(versionId, assetType);

    await safeRevalidatePath(existingAsset.projectId);

    return { success: true };
  } catch (error) {
    console.error("删除版本失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除版本失败",
    };
  }
}
