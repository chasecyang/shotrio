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
import { getR2Client, getR2Config, getPublicUrl } from "./r2.config";

// 允许的图片格式
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

// 允许的视频格式
export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

// 允许的音频格式
export const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",      // mp3
  "audio/mp3",       // mp3 (alias)
  "audio/wav",       // wav
  "audio/x-wav",     // wav (alias)
  "audio/ogg",       // ogg
  "audio/opus",      // opus
  "audio/aac",       // aac
  "audio/m4a",       // m4a
  "audio/x-m4a",     // m4a (alias)
  "audio/webm",      // webm audio
] as const;

// 最大文件大小 (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 最大视频文件大小 (100MB)
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

// 最大音频文件大小 (50MB)
export const MAX_AUDIO_SIZE = 50 * 1024 * 1024;

// 资产分类枚举（适用于所有用户资产）
export enum AssetCategory {
  AVATARS = "avatars",       // 头像图片
  VIDEOS = "videos",         // 视频
  AUDIOS = "audios",         // 音频
  PROJECTS = "projects",     // 项目图片
  THUMBNAILS = "thumbnails", // 视频缩略图
  OTHER = "other",           // 其他
}

export interface UploadOptions {
  userId: string;               // 用户ID（必填）
  category?: AssetCategory;     // 资产分类（默认为 OTHER）
  metadata?: Record<string, string>;
}

/**
 * 生成存储路径
 * 结构: users/{userId}/{category}/{timestamp}-{uuid}.{ext}
 */
function generateStorageKey(
  originalName: string, 
  userId: string,
  category: AssetCategory = AssetCategory.OTHER
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

/**
 * 验证视频文件类型和大小
 */
function validateVideoFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type as typeof ALLOWED_VIDEO_TYPES[number])) {
    return {
      valid: false,
      error: `不支持的视频格式。仅支持: ${ALLOWED_VIDEO_TYPES.join(", ")}`,
    };
  }

  if (file.size > MAX_VIDEO_SIZE) {
    return {
      valid: false,
      error: `视频文件大小超过限制。最大允许: ${MAX_VIDEO_SIZE / 1024 / 1024}MB`,
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
 * @param input - File 对象或图片 URL
 * @param options - 上传选项（必须包含 userId）
 */
export async function uploadImageToR2(
  input: File | string,
  options: UploadOptions
): Promise<{
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}> {
  try {
    const r2Client = getR2Client();
    const { bucketName } = getR2Config();

    if (!options.userId) {
      return { success: false, error: "缺少用户ID" };
    }

    const category = options.category || AssetCategory.OTHER;
    const metadata = options.metadata || {};

    let buffer: Buffer;
    let contentType: string;
    let fileName: string;
    let fileSize: number;

    // 判断输入类型：File 对象或 URL 字符串
    if (typeof input === "string") {
      // 从 URL 下载图片
      const response = await fetch(input);
      if (!response.ok) {
        return { 
          success: false, 
          error: `下载图片失败: ${response.statusText}` 
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      contentType = response.headers.get("content-type") || "image/png";
      fileSize = buffer.length;
      
      // 从 URL 或 content-type 生成文件名
      const ext = contentType.split("/")[1] || "png";
      fileName = `downloaded-image.${ext}`;

      metadata.originalUrl = input;
    } else {
      // File 对象
      const validation = validateFile(input);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const arrayBuffer = await input.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      contentType = input.type;
      fileName = input.name;
      fileSize = input.size;

      metadata.originalName = encodeURIComponent(input.name);
    }

    // 验证内容类型
    if (!ALLOWED_IMAGE_TYPES.includes(contentType as typeof ALLOWED_IMAGE_TYPES[number])) {
      return {
        success: false,
        error: `不支持的图片格式: ${contentType}`,
      };
    }

    // 验证文件大小
    if (fileSize > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `文件大小超过限制。最大允许: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      };
    }

    // 生成 Key (包含 userId 和 category)
    const key = generateStorageKey(fileName, options.userId, category);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: fileSize,
      Metadata: {
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
 * 上传视频到 R2
 * 
 * @param input - File 对象或视频 URL
 * @param options - 上传选项（必须包含 userId）
 */
export async function uploadVideoToR2(
  input: File | string,
  options: UploadOptions
): Promise<{
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}> {
  try {
    const r2Client = getR2Client();
    const { bucketName } = getR2Config();

    if (!options.userId) {
      return { success: false, error: "缺少用户ID" };
    }

    const category = options.category || AssetCategory.VIDEOS;
    const metadata = options.metadata || {};

    let buffer: Buffer;
    let contentType: string;
    let fileName: string;
    let fileSize: number;

    // 判断输入类型：File 对象或 URL 字符串
    if (typeof input === "string") {
      // 从 URL 下载视频
      const response = await fetch(input);
      if (!response.ok) {
        return { 
          success: false, 
          error: `下载视频失败: ${response.statusText}` 
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      contentType = response.headers.get("content-type") || "video/mp4";
      fileSize = buffer.length;
      
      // 从 URL 或 content-type 生成文件名
      const ext = contentType.split("/")[1] || "mp4";
      fileName = `downloaded-video.${ext}`;

      metadata.originalUrl = input;
    } else {
      // File 对象
      const validation = validateVideoFile(input);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const arrayBuffer = await input.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      contentType = input.type;
      fileName = input.name;
      fileSize = input.size;

      metadata.originalName = encodeURIComponent(input.name);
    }

    // 验证内容类型
    if (!ALLOWED_VIDEO_TYPES.includes(contentType as typeof ALLOWED_VIDEO_TYPES[number])) {
      return {
        success: false,
        error: `不支持的视频格式: ${contentType}`,
      };
    }

    // 验证文件大小
    if (fileSize > MAX_VIDEO_SIZE) {
      return {
        success: false,
        error: `视频文件大小超过限制。最大允许: ${MAX_VIDEO_SIZE / 1024 / 1024}MB`,
      };
    }

    // 生成 Key (包含 userId 和 category)
    const key = generateStorageKey(fileName, options.userId, category);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: fileSize,
      Metadata: {
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
    console.error("上传视频到 R2 失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "上传失败",
    };
  }
}

/**
 * 上传音频到 R2
 *
 * @param input - File 对象或音频 URL
 * @param options - 上传选项（必须包含 userId）
 */
export async function uploadAudioToR2(
  input: File | string,
  options: UploadOptions
): Promise<{
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}> {
  try {
    const r2Client = getR2Client();
    const { bucketName } = getR2Config();

    if (!options.userId) {
      return { success: false, error: "缺少用户ID" };
    }

    const category = options.category || AssetCategory.AUDIOS;
    const metadata = options.metadata || {};

    let buffer: Buffer;
    let contentType: string;
    let fileName: string;
    let fileSize: number;

    // 判断输入类型：File 对象或 URL 字符串
    if (typeof input === "string") {
      // 从 URL 下载音频
      const response = await fetch(input);
      if (!response.ok) {
        return {
          success: false,
          error: `下载音频失败: ${response.statusText}`
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      contentType = response.headers.get("content-type") || "audio/mpeg";
      fileSize = buffer.length;

      // 从 content-type 生成文件名
      let ext = "mp3";
      if (contentType.includes("wav")) ext = "wav";
      else if (contentType.includes("ogg")) ext = "ogg";
      else if (contentType.includes("opus")) ext = "opus";
      else if (contentType.includes("m4a") || contentType.includes("aac")) ext = "m4a";
      else if (contentType.includes("webm")) ext = "webm";

      fileName = `downloaded-audio.${ext}`;
      metadata.originalUrl = input;
    } else {
      // File 对象
      if (input.size > MAX_AUDIO_SIZE) {
        return {
          success: false,
          error: `音频文件大小超过限制。最大允许: ${MAX_AUDIO_SIZE / 1024 / 1024}MB`,
        };
      }

      const arrayBuffer = await input.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      contentType = input.type;
      fileName = input.name;
      fileSize = input.size;

      metadata.originalName = encodeURIComponent(input.name);
    }

    // 验证文件大小
    if (fileSize > MAX_AUDIO_SIZE) {
      return {
        success: false,
        error: `音频文件大小超过限制。最大允许: ${MAX_AUDIO_SIZE / 1024 / 1024}MB`,
      };
    }

    // 生成 Key (包含 userId 和 category)
    const key = generateStorageKey(fileName, options.userId, category);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: fileSize,
      Metadata: {
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
    console.error("上传音频到 R2 失败:", error);
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
    const r2Client = getR2Client();
    const { bucketName } = getR2Config();

    // 验证文件所有权
    const headCommand = new HeadObjectCommand({
      Bucket: bucketName,
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
      Bucket: bucketName,
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
    const r2Client = getR2Client();
    const { bucketName } = getR2Config();

    const command = new HeadObjectCommand({
      Bucket: bucketName,
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
