"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createJob } from "@/lib/actions/job";
import type { ImageResolution } from "@/types/asset";
import type { AssetImageGenerationInput } from "@/types/job";
import type { AspectRatio } from "@/lib/services/fal.service";

/**
 * 生成素材图片的输入参数（文生图）
 * 用户 UI 调用时不需要提供 name/tags，由 AI 自动分析
 */
export interface GenerateAssetImageInput {
  projectId: string;
  prompt: string;
  aspectRatio?: AspectRatio;
  resolution?: ImageResolution;
  numImages?: number;
}

/**
 * 编辑素材图片的输入参数（图生图）
 * 用户 UI 调用时不需要提供 name/tags，由 AI 自动分析
 */
export interface EditAssetImageInput {
  projectId: string;
  sourceAssetIds: string[];
  editPrompt: string;
  aspectRatio?: AspectRatio | "auto";
  resolution?: ImageResolution;
  numImages?: number;
}

/**
 * 生成素材图片的返回结果（改为返回jobId）
 */
export interface GenerateAssetImageJobResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

/**
 * 生成素材图片（文生图）- 改为创建后台任务
 */
export async function generateAssetImage(
  input: GenerateAssetImageInput
): Promise<GenerateAssetImageJobResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const {
      projectId,
      prompt,
      aspectRatio = "16:9",
      resolution = "2K",
      numImages = 1,
    } = input;

    // 验证参数
    if (!prompt || !prompt.trim()) {
      return { success: false, error: "请输入提示词" };
    }

    // 创建后台任务（不提供 name/tags，让 AI 自动分析）
    const jobInput: AssetImageGenerationInput = {
      projectId,
      prompt: prompt.trim(),
      aspectRatio,
      resolution: resolution as ImageResolution,
      numImages,
    };

    const jobResult = await createJob({
      userId: session.user.id,
      projectId,
      type: "asset_image_generation",
      inputData: jobInput,
    });

    if (!jobResult.success || !jobResult.jobId) {
      return { 
        success: false, 
        error: jobResult.error || "创建任务失败" 
      };
    }

    return {
      success: true,
      jobId: jobResult.jobId,
    };
  } catch (error) {
    console.error("创建素材生成任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建任务失败",
    };
  }
}

/**
 * 编辑素材图片（图生图）- 改为创建后台任务
 */
export async function editAssetImage(
  input: EditAssetImageInput
): Promise<GenerateAssetImageJobResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const {
      projectId,
      sourceAssetIds,
      editPrompt,
      aspectRatio = "auto",
      resolution = "2K",
      numImages = 1,
    } = input;

    // 验证参数
    if (!sourceAssetIds || sourceAssetIds.length === 0) {
      return { success: false, error: "请选择参考素材" };
    }

    if (sourceAssetIds.length > 14) {
      return { success: false, error: "最多支持 14 张参考图" };
    }

    if (!editPrompt || !editPrompt.trim()) {
      return { success: false, error: "请输入编辑提示词" };
    }

    // 创建后台任务（不提供 name/tags，让 AI 自动分析）
    const jobInput: AssetImageGenerationInput = {
      projectId,
      prompt: editPrompt.trim(),
      aspectRatio,
      resolution: resolution as ImageResolution,
      numImages,
      sourceAssetIds,
    };

    const jobResult = await createJob({
      userId: session.user.id,
      projectId,
      type: "asset_image_generation",
      inputData: jobInput,
    });

    if (!jobResult.success || !jobResult.jobId) {
      return { 
        success: false, 
        error: jobResult.error || "创建任务失败" 
      };
    }

    return {
      success: true,
      jobId: jobResult.jobId,
    };
  } catch (error) {
    console.error("创建素材编辑任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建任务失败",
    };
  }
}

