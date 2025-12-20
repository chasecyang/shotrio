"use server";

import { uploadImageToR2, AssetCategory } from "@/lib/storage/r2.service";
import { createAsset } from "@/lib/actions/asset";

interface UploadAssetParams {
  projectId: string;
  userId: string;
  assetName: string;
  tags?: string[];  // 可选标签
  file: File;
}

export async function uploadAsset({
  projectId,
  userId,
  assetName,
  tags = [],  // 可选标签，不提供时由用户后续添加
  file,
}: UploadAssetParams): Promise<{
  success: boolean;
  error?: string;
  assetId?: string;
}> {
  try {
    // 验证文件类型
    if (!file.type.startsWith("image/")) {
      return { success: false, error: "请选择图片文件" };
    }

    // 验证文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: "文件大小不能超过 10MB" };
    }

    // 上传文件到 R2
    const uploadResult = await uploadImageToR2(file, {
      userId,
      category: AssetCategory.PROJECTS,
      metadata: {
        projectId,
      },
    });

    if (!uploadResult.success || !uploadResult.url) {
      return { success: false, error: uploadResult.error || "上传失败" };
    }

    // 创建资产记录
    const createResult = await createAsset({
      projectId,
      name: assetName.trim(),
      imageUrl: uploadResult.url,
      thumbnailUrl: uploadResult.url,
      tags,
    });

    if (!createResult.success) {
      return { success: false, error: createResult.error || "创建素材记录失败" };
    }

    return {
      success: true,
      assetId: createResult.asset?.id,
    };
  } catch (error) {
    console.error("上传素材失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "上传失败",
    };
  }
}

