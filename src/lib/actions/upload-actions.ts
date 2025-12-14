"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  uploadImageToR2,
  uploadVideoToR2,
  deleteImageFromR2,
  extractKeyFromUrl,
  ImageCategory,
} from "@/lib/storage";

/**
 * 上传图片 Server Action
 */
export async function uploadImage(
  formData: FormData,
  category: ImageCategory = ImageCategory.OTHER
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
  category: ImageCategory = ImageCategory.OTHER,
  userId?: string
): Promise<{ success: boolean; url?: string; key?: string; error?: string }> {
  try {
    // 下载图片
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    // 获取图片数据
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 从 URL 或 Content-Type 获取文件扩展名
    const contentType = response.headers.get("content-type") || "image/png";
    const extension = contentType.split("/")[1] || "png";

    // 创建一个 File 对象
    const filename = `generated-${Date.now()}.${extension}`;
    const file = new File([buffer], filename, { type: contentType });

    // 上传到 R2
    const result = await uploadImageToR2(file, {
      userId: userId || "system", // 使用提供的用户ID或系统用户ID
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
  category: ImageCategory = ImageCategory.OTHER
): Promise<{ success: boolean; url?: string; key?: string; error?: string }> {
  try {
    console.log(`[Upload] 开始下载视频: ${videoUrl}`);
    
    // 下载视频
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.statusText}`);
    }

    // 获取视频数据
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[Upload] 视频下载完成，大小: ${buffer.length} bytes`);

    // 从 URL 或 Content-Type 获取文件类型
    const contentType = response.headers.get("content-type") || "video/mp4";

    // 创建一个 File 对象
    const file = new File([buffer], filename, { type: contentType });

    console.log(`[Upload] 开始上传到 R2...`);

    // 上传到 R2
    const result = await uploadVideoToR2(file, {
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

