"use server";

import {
  uploadImageToR2,
  uploadVideoToR2,
  uploadAudioToR2,
  AssetCategory,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_AUDIO_TYPES,
  MAX_FILE_SIZE,
  MAX_VIDEO_SIZE,
  MAX_AUDIO_SIZE,
} from "@/lib/storage/r2.service";
import { createAsset } from "./base-crud";
import { analyzeDescriptionForAsset } from "@/lib/services/ai-tagging.service";
import type { AssetTypeEnum } from "@/types/asset";

type MediaType = "image" | "video" | "audio";

interface UploadMediaAssetParams {
  projectId: string;
  userId: string;
  file: File;
  description: string;
}

interface UploadMediaAssetResult {
  success: boolean;
  assetId?: string;
  error?: string;
}

/**
 * 检测媒体类型
 */
function detectMediaType(mimeType: string): MediaType | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return null;
}

/**
 * 获取媒体类型的中文标签
 */
function getMediaTypeLabel(mediaType: MediaType): string {
  switch (mediaType) {
    case "image":
      return "图片";
    case "video":
      return "视频";
    case "audio":
      return "音频";
  }
}

/**
 * 获取媒体类型的默认标签
 */
function getDefaultTag(mediaType: MediaType): string {
  switch (mediaType) {
    case "image":
      return "参考";
    case "video":
      return "视频";
    case "audio":
      return "音频";
  }
}

/**
 * 验证文件类型和大小
 */
function validateFile(
  file: File,
  mediaType: MediaType
): { valid: boolean; error?: string } {
  switch (mediaType) {
    case "image": {
      if (
        !ALLOWED_IMAGE_TYPES.includes(
          file.type as (typeof ALLOWED_IMAGE_TYPES)[number]
        )
      ) {
        return {
          valid: false,
          error: `不支持的图片格式。支持: JPEG, PNG, WebP, GIF`,
        };
      }
      if (file.size > MAX_FILE_SIZE) {
        return {
          valid: false,
          error: `图片大小超过限制（最大 ${MAX_FILE_SIZE / 1024 / 1024}MB）`,
        };
      }
      break;
    }
    case "video": {
      if (
        !ALLOWED_VIDEO_TYPES.includes(
          file.type as (typeof ALLOWED_VIDEO_TYPES)[number]
        )
      ) {
        return {
          valid: false,
          error: `不支持的视频格式。支持: MP4, WebM, QuickTime`,
        };
      }
      if (file.size > MAX_VIDEO_SIZE) {
        return {
          valid: false,
          error: `视频大小超过限制（最大 ${MAX_VIDEO_SIZE / 1024 / 1024}MB）`,
        };
      }
      break;
    }
    case "audio": {
      const isValidAudio = ALLOWED_AUDIO_TYPES.some(
        (type) => file.type === type || file.type.startsWith(type.split("/")[0])
      );
      if (!isValidAudio) {
        return {
          valid: false,
          error: `不支持的音频格式。支持: MP3, WAV, OGG, M4A 等`,
        };
      }
      if (file.size > MAX_AUDIO_SIZE) {
        return {
          valid: false,
          error: `音频大小超过限制（最大 ${MAX_AUDIO_SIZE / 1024 / 1024}MB）`,
        };
      }
      break;
    }
  }

  return { valid: true };
}

/**
 * 上传文件到 R2
 */
async function uploadToR2(
  file: File,
  mediaType: MediaType,
  userId: string,
  projectId: string
) {
  const metadata = { projectId };

  switch (mediaType) {
    case "image":
      return uploadImageToR2(file, {
        userId,
        category: AssetCategory.PROJECTS,
        metadata,
      });
    case "video":
      return uploadVideoToR2(file, {
        userId,
        category: AssetCategory.VIDEOS,
        metadata,
      });
    case "audio":
      return uploadAudioToR2(file, {
        userId,
        category: AssetCategory.AUDIOS,
        metadata,
      });
  }
}

/**
 * 根据媒体类型构建创建素材所需的数据
 */
function buildMediaData(mediaType: MediaType, url: string) {
  switch (mediaType) {
    case "image":
      return {
        imageData: {
          imageUrl: url,
          thumbnailUrl: url,
        },
      };
    case "video":
      return {
        videoData: {
          videoUrl: url,
        },
      };
    case "audio":
      return {
        audioData: {
          audioUrl: url,
        },
      };
  }
}

/**
 * 从文件名获取默认名称（去掉扩展名）
 */
function getNameFromFile(file: File): string {
  return file.name.replace(/\.[^/.]+$/, "");
}

/**
 * 上传多媒体素材（图片/视频/音频）
 * 支持 AI 基于用户描述自动生成名称和标签
 */
export async function uploadMediaAsset({
  projectId,
  userId,
  file,
  description,
}: UploadMediaAssetParams): Promise<UploadMediaAssetResult> {
  try {
    // 1. 检测媒体类型
    const mediaType = detectMediaType(file.type);
    if (!mediaType) {
      return {
        success: false,
        error: `不支持的文件格式: ${file.type}`,
      };
    }

    // 2. 验证文件
    const validation = validateFile(file, mediaType);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // 3. AI 分析描述生成名称和标签
    let analysis = { name: "", tags: [] as string[] };
    const trimmedDescription = description.trim();

    if (trimmedDescription) {
      // 有描述时使用 AI 分析
      analysis = await analyzeDescriptionForAsset(trimmedDescription, mediaType);
    } else {
      // 无描述时使用文件名和默认标签
      analysis.name = getNameFromFile(file);
      analysis.tags = [getDefaultTag(mediaType)];
    }

    // 4. 上传到 R2
    const uploadResult = await uploadToR2(file, mediaType, userId, projectId);
    if (!uploadResult.success || !uploadResult.url) {
      return {
        success: false,
        error: uploadResult.error || "文件上传失败",
      };
    }

    // 5. 创建素材记录
    const mediaData = buildMediaData(mediaType, uploadResult.url);
    const createResult = await createAsset({
      projectId,
      name: analysis.name,
      assetType: mediaType as AssetTypeEnum,
      sourceType: "uploaded",
      tags: analysis.tags,
      ...mediaData,
    });

    if (!createResult.success) {
      return {
        success: false,
        error: createResult.error || "创建素材记录失败",
      };
    }

    return {
      success: true,
      assetId: createResult.asset?.id,
    };
  } catch (error) {
    console.error("上传媒体素材失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "上传失败",
    };
  }
}
