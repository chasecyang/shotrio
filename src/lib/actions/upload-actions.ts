"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  uploadImageToR2,
  uploadVideoToR2,
  deleteImageFromR2,
  extractKeyFromUrl,
  AssetCategory,
} from "@/lib/storage";

/**
 * 上传图片 Server Action
 */
export async function uploadImage(
  formData: FormData,
  category: AssetCategory = AssetCategory.OTHER
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "未选择文件" };
    }

    const result = await uploadImageToR2(file, {
      userId: session.user.id,
      category,
    });

    return result;
  } catch (error) {
    console.error("上传图片失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "上传失败",
    };
  }
}

/**
 * 从 URL 下载图片并上传到 R2
 * 用于将 AI 生成的图片保存到我们的存储
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  category: AssetCategory = AssetCategory.OTHER,
  userId?: string
): Promise<{ success: boolean; url?: string; key?: string; error?: string }> {
  try {
    // 直接使用重构后的 uploadImageToR2（现在支持 URL）
    const result = await uploadImageToR2(imageUrl, {
      userId: userId || "system",
      category,
    });

    return result;
  } catch (error) {
    console.error("从 URL 上传图片失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "上传失败",
    };
  }
}

/**
 * 从 URL 下载视频并上传到 R2
 * 用于将 AI 生成的视频保存到我们的存储
 */
export async function uploadVideoFromUrl(
  videoUrl: string,
  filename: string,
  userId: string,
  category: AssetCategory = AssetCategory.VIDEOS
): Promise<{ success: boolean; url?: string; key?: string; error?: string }> {
  try {
    console.log(`[Upload] 开始下载视频，长度: ${videoUrl.length}`);

    // 直接使用重构后的 uploadVideoToR2（现在支持 URL）
    const result = await uploadVideoToR2(videoUrl, {
      userId,
      category,
    });

    if (result.success) {
      console.log(`[Upload] 视频上传成功: ${result.url}`);
    } else {
      console.error(`[Upload] 视频上传失败: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.error("从 URL 上传视频失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "上传失败",
    };
  }
}

/**
 * 删除图片 Server Action
 */
export async function deleteImage(urlOrKey: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const key = extractKeyFromUrl(urlOrKey);
    if (!key) {
      return { success: false, error: "无效的图片地址" };
    }

    const result = await deleteImageFromR2(key, session.user.id);
    return result;
  } catch (error) {
    console.error("删除图片失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    };
  }
}
