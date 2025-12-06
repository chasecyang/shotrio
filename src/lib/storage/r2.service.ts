/**
 * Cloudflare R2 存储服务
 * 
 * 提供图片上传、删除、获取URL等功能
 */

import { 
  PutObjectCommand, 
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { r2Client, R2_CONFIG, getPublicUrl } from "./r2.config";

// 允许的图片格式
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

// 最大文件大小 (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 图片分类枚举
export enum ImageCategory {
  AVATARS = "avatars",       // 用户头像
  PROJECTS = "projects",      // 项目相关图片
  CHARACTERS = "characters",  // 角色图片
  EPISODES = "episodes",      // 剧集图片
  COVERS = "covers",          // 封面图片
  OTHER = "other",            // 其他
}

export interface UploadOptions {
  userId: string;               // 用户ID（必填）
  category?: ImageCategory;     // 图片分类（默认为 OTHER）
  metadata?: Record<string, string>;
}

/**
 * 生成存储路径
 * 结构: users/{userId}/{category}/{timestamp}-{uuid}.{ext}
 */
function generateStorageKey(
  originalName: string, 
  userId: string,
  category: ImageCategory = ImageCategory.OTHER
): string {
  const timestamp = Date.now();
  const uuid = crypto.randomUUID();
  const ext = originalName.split(".").pop()?.toLowerCase() || "jpg";
  
  return `users/${userId}/${category}/${timestamp}-${uuid}.${ext}`;
}

/**
 * 验证文件类型和大小
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
    return {
      valid: false,
      error: `不支持的文件格式。仅支持: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `文件大小超过限制。最大允许: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

export function getImageUrl(key: string): string {
  return getPublicUrl(key) || "";
}

/**
 * 上传图片到 R2
 * 
 * @param file - 要上传的文件
 * @param options - 上传选项（必须包含 userId）
 */
export async function uploadImageToR2(
  file: File,
  options: UploadOptions
): Promise<{
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}> {
  try {
    if (!options.userId) {
      return { success: false, error: "缺少用户ID" };
    }

    const validation = validateFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const category = options.category || ImageCategory.OTHER;
    const metadata = options.metadata || {};

    // 生成 Key (包含 userId 和 category)
    const key = generateStorageKey(file.name, options.userId, category);

    // 转换为 Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const command = new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      ContentLength: file.size,
      Metadata: {
        originalName: file.name,
        userId: options.userId,
        category,
        uploadedAt: new Date().toISOString(),
        ...metadata
      },
    });

    await r2Client.send(command);

    const url = getPublicUrl(key);
    
    if (!url) {
      throw new Error("未配置 R2_PUBLIC_DOMAIN，无法生成访问链接");
    }

    return {
      success: true,
      url,
      key,
    };
  } catch (error) {
    console.error("上传图片到 R2 失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "上传失败",
    };
  }
}

/**
 * 删除图片（需验证用户权限）
 * 
 * @param key - 文件的存储 key
 * @param userId - 当前用户ID
 */
export async function deleteImageFromR2(
  key: string,
  userId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // 验证文件所有权
    const headCommand = new HeadObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
    });

    const metadata = await r2Client.send(headCommand);
    const fileUserId = metadata.Metadata?.userId;

    if (!fileUserId || fileUserId !== userId) {
      return { 
        success: false, 
        error: "无权删除该文件" 
      };
    }

    // 删除文件
    const deleteCommand = new DeleteObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
    });

    await r2Client.send(deleteCommand);
    return { success: true };
  } catch (error) {
    console.error("从 R2 删除图片失败:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "删除失败" 
    };
  }
}

/**
 * 检查图片是否存在
 */
export async function checkImageExists(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
    });
    await r2Client.send(command);
    return true;
  } catch {
    return false;
  }
}

/**
 * 提取 Key 的辅助函数
 */
export function extractKeyFromUrl(url: string): string | null {
  try {
    if (!url.startsWith("http")) return url;
    const urlObj = new URL(url);
    return urlObj.pathname.replace(/^\//, "") || null;
  } catch {
    return url;
  }
}
