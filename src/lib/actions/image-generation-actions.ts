"use server";

import {
  generateImagePro,
  editImagePro,
  queueTextToImagePro,
  queueImageToImagePro,
  getQueueStatusPro,
  getQueueResultPro,
  type TextToImageInput,
  type ImageToImageInput,
  type GenerateImageOutput,
  type AspectRatio,
  type Resolution,
} from "@/lib/services/fal.service";
import { uploadImageFromUrl } from "./upload-actions";

// ============= 角色图像生成 =============

/**
 * 生成角色图像（文生图）
 * 用于根据角色描述生成角色形象
 */
export async function generateCharacterImage(params: {
  characterDescription: string;
  aspectRatio?: AspectRatio;
  resolution?: Resolution;
  numImages?: number;
}): Promise<{
  success: boolean;
  images?: Array<{
    url: string;
    r2Key?: string;
  }>;
  description?: string;
  error?: string;
}> {
  try {
    const input: TextToImageInput = {
      prompt: params.characterDescription,
      num_images: params.numImages ?? 1,
      aspect_ratio: params.aspectRatio ?? "3:4", // 角色默认使用竖版
      resolution: params.resolution ?? "2K",
      output_format: "png",
    };

    const result = await generateImagePro(input);

    // 上传到 R2 存储
    const imagesWithR2 = await Promise.all(
      result.images.map(async (img) => {
        try {
          const uploadResult = await uploadImageFromUrl(img.url);
          return {
            url: uploadResult.success && uploadResult.url ? uploadResult.url : img.url,
            r2Key: uploadResult.key ?? undefined,
          };
        } catch (error) {
          console.error("上传到 R2 失败:", error);
          return {
            url: img.url,
          };
        }
      })
    );

    return {
      success: true,
      images: imagesWithR2,
      description: result.description,
    };
  } catch (error) {
    console.error("生成角色图像失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "生成角色图像失败",
    };
  }
}

/**
 * 编辑/优化角色图像（图生图）
 * 用于基于现有角色图像进行调整和优化
 */
export async function editCharacterImage(params: {
  originalImageUrls: string[]; // 可以提供多张参考图
  editPrompt: string;
  aspectRatio?: AspectRatio | "auto";
  resolution?: Resolution;
  numImages?: number;
}): Promise<{
  success: boolean;
  images?: Array<{
    url: string;
    r2Key?: string;
  }>;
  description?: string;
  error?: string;
}> {
  try {
    const input: ImageToImageInput = {
      prompt: params.editPrompt,
      image_urls: params.originalImageUrls,
      num_images: params.numImages ?? 1,
      aspect_ratio: params.aspectRatio ?? "auto",
      resolution: params.resolution ?? "2K",
      output_format: "png",
    };

    const result = await editImagePro(input);

    // 上传到 R2 存储
    const imagesWithR2 = await Promise.all(
      result.images.map(async (img) => {
        try {
          const uploadResult = await uploadImageFromUrl(img.url);
          return {
            url: uploadResult.success && uploadResult.url ? uploadResult.url : img.url,
            r2Key: uploadResult.key ?? undefined,
          };
        } catch (error) {
          console.error("上传到 R2 失败:", error);
          return {
            url: img.url,
          };
        }
      })
    );

    return {
      success: true,
      images: imagesWithR2,
      description: result.description,
    };
  } catch (error) {
    console.error("编辑角色图像失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "编辑角色图像失败",
    };
  }
}

/**
 * 场景中的角色合成（图生图 + 多图输入）
 * 用于将角色图像放入特定场景中，保持角色一致性
 */
export async function composeCharacterInScene(params: {
  characterImageUrls: string[]; // 角色参考图（最多5个角色）
  sceneImageUrl?: string; // 可选的场景参考图
  compositionPrompt: string; // 合成描述，如 "将这个角色放在海滩场景中"
  aspectRatio?: AspectRatio;
  resolution?: Resolution;
}): Promise<{
  success: boolean;
  images?: Array<{
    url: string;
    r2Key?: string;
  }>;
  description?: string;
  error?: string;
}> {
  try {
    const imageUrls = params.sceneImageUrl
      ? [...params.characterImageUrls, params.sceneImageUrl]
      : params.characterImageUrls;

    const input: ImageToImageInput = {
      prompt: params.compositionPrompt,
      image_urls: imageUrls,
      num_images: 1,
      aspect_ratio: params.aspectRatio ?? "16:9",
      resolution: params.resolution ?? "2K",
      output_format: "png",
    };

    const result = await editImagePro(input);

    // 上传到 R2 存储
    const imagesWithR2 = await Promise.all(
      result.images.map(async (img) => {
        try {
          const uploadResult = await uploadImageFromUrl(img.url);
          return {
            url: uploadResult.success && uploadResult.url ? uploadResult.url : img.url,
            r2Key: uploadResult.key ?? undefined,
          };
        } catch (error) {
          console.error("上传到 R2 失败:", error);
          return {
            url: img.url,
          };
        }
      })
    );

    return {
      success: true,
      images: imagesWithR2,
      description: result.description,
    };
  } catch (error) {
    console.error("合成角色场景失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "合成角色场景失败",
    };
  }
}

// ============= 队列状态查询 =============

/**
 * 查询图像生成队列状态
 */
export async function getImageGenerationStatus(params: {
  requestId: string;
  modelType?: "text-to-image" | "image-to-image";
}): Promise<{
  success: boolean;
  status?: string;
  data?: unknown;
  error?: string;
}> {
  try {
    const status = await getQueueStatusPro(
      params.requestId,
      params.modelType ?? "text-to-image"
    );

    return {
      success: true,
      status: status.status,
      data: status,
    };
  } catch (error) {
    console.error("查询队列状态失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "查询队列状态失败",
    };
  }
}

/**
 * 获取图像生成队列结果
 */
export async function getImageGenerationResult(params: {
  requestId: string;
  modelType?: "text-to-image" | "image-to-image";
}): Promise<{
  success: boolean;
  images?: Array<{
    url: string;
    r2Key?: string;
  }>;
  description?: string;
  error?: string;
}> {
  try {
    const result = await getQueueResultPro(
      params.requestId,
      params.modelType ?? "text-to-image"
    );

    // 上传到 R2 存储
    const imagesWithR2 = await Promise.all(
      result.images.map(async (img) => {
        try {
          const uploadResult = await uploadImageFromUrl(img.url);
          return {
            url: uploadResult.success && uploadResult.url ? uploadResult.url : img.url,
            r2Key: uploadResult.key ?? undefined,
          };
        } catch (error) {
          console.error("上传到 R2 失败:", error);
          return {
            url: img.url,
          };
        }
      })
    );

    return {
      success: true,
      images: imagesWithR2,
      description: result.description,
    };
  } catch (error) {
    console.error("获取队列结果失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取队列结果失败",
    };
  }
}

