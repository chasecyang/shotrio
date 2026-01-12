"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createJob } from "@/lib/actions/job";
import { createAssetInternal } from "@/lib/actions/asset/crud";
import type { ImageResolution, ImageGenerationConfig } from "@/types/asset";
import type { AspectRatio } from "@/lib/services/image.service";
import db from "@/lib/db";
import { asset } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";

/**
 * 查询资产的激活版本 ID
 * 用于在创建任务时记录源资产的版本快照
 */
async function resolveAssetVersionId(assetId: string): Promise<string | null> {
  const imageAsset = await db.query.asset.findFirst({
    where: eq(asset.id, assetId),
    with: {
      imageDataList: true,
    },
  });

  const activeImageData = imageAsset?.imageDataList?.find(
    (img: { id: string; isActive: boolean }) => img.isActive
  );

  return activeImageData?.id ?? null;
}

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
 * 生成素材图片的返回结果
 */
export interface GenerateAssetImageJobResult {
  success: boolean;
  assetId?: string;  // 创建的素材ID
  jobId?: string;    // 生成任务ID
  error?: string;
}

/**
 * 生成素材图片（文生图）- 新架构：先创建 asset，再创建 job
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

    // 第一步：创建素材记录（包含所有生成信息，但无图片）
    // 使用临时名称，由 AI worker 分析后可能会更新
    const assetName = `AI生成-${Date.now()}`;

    const createResult = await createAssetInternal({
      projectId,
      userId: session.user.id,
      name: assetName,
      assetType: "image",
      sourceType: "generated", // ✅ 标记为生成类资产，状态从job计算
      imageData: {
        prompt: prompt.trim(),
        modelUsed: "nano-banana-pro",
        generationConfig: JSON.stringify({
          aspectRatio: aspectRatio,
          resolution: resolution,
          numImages: numImages,
        }),
      },
      meta: {
        generationParams: {
          aspectRatio: aspectRatio as "16:9" | "1:1" | "9:16",
          resolution: resolution,
          numImages: numImages,
        },
      },
    });

    if (!createResult.success || !createResult.asset) {
      return {
        success: false,
        error: createResult.error || "创建素材失败",
      };
    }

    const assetId = createResult.asset.id;
    const imageDataId = createResult.imageDataId;

    // 第二步：创建图片生成任务（关联到版本）
    const jobResult = await createJob({
      userId: session.user.id,
      projectId,
      type: "asset_image",
      assetId: assetId, // 外键关联（向后兼容）
      imageDataId: imageDataId, // 关联到具体版本
      inputData: {}, // 所有生成信息已存储在 imageData 中
    });

    if (!jobResult.success || !jobResult.jobId) {
      return {
        success: false,
        error: jobResult.error || "创建任务失败"
      };
    }

    return {
      success: true,
      assetId,
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
 * 编辑素材图片（图生图）- 新架构：先创建 asset，再创建 job
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

    if (sourceAssetIds.length > 8) {
      return { success: false, error: "最多支持 8 张参考图" };
    }

    if (!editPrompt || !editPrompt.trim()) {
      return { success: false, error: "请输入编辑提示词" };
    }

    // 查询源资产的激活版本，记录版本快照
    const sourceVersionIds: string[] = [];
    for (const sourceId of sourceAssetIds) {
      const versionId = await resolveAssetVersionId(sourceId);
      if (versionId) {
        sourceVersionIds.push(versionId);
      }
    }

    // 构建包含版本快照的 generationConfig
    const generationConfig: ImageGenerationConfig = {
      aspectRatio: aspectRatio === "auto" ? undefined : aspectRatio,
      resolution: resolution,
      numImages: numImages,
    };

    // 如果有版本快照，添加到 config 中
    if (sourceVersionIds.length > 0) {
      generationConfig._versionSnapshot = {
        source_image_version_ids: sourceVersionIds,
      };
    }

    // 第一步：创建素材记录（包含所有生成信息，但无图片）
    // 使用临时名称，由 AI worker 分析后可能会更新
    const assetName = `图生图-${Date.now()}`;

    const createResult = await createAssetInternal({
      projectId,
      userId: session.user.id,
      name: assetName,
      assetType: "image",
      sourceType: "generated", // ✅ 标记为生成类资产
      imageData: {
        prompt: editPrompt.trim(),
        modelUsed: "nano-banana-pro",
        sourceAssetIds: sourceAssetIds,
        generationConfig: JSON.stringify(generationConfig),
      },
      meta: {
        generationParams: {
          aspectRatio: aspectRatio as "16:9" | "1:1" | "9:16",
          resolution: resolution,
          numImages: numImages,
        },
      },
    });

    if (!createResult.success || !createResult.asset) {
      return {
        success: false,
        error: createResult.error || "创建素材失败",
      };
    }

    const assetId = createResult.asset.id;
    const imageDataId = createResult.imageDataId;

    // 第二步：创建图片生成任务（关联到版本）
    const jobResult = await createJob({
      userId: session.user.id,
      projectId,
      type: "asset_image",
      assetId: assetId, // 外键关联（向后兼容）
      imageDataId: imageDataId, // 关联到具体版本
      inputData: {}, // 所有生成信息已存储在 imageData 中
    });

    if (!jobResult.success || !jobResult.jobId) {
      return {
        success: false,
        error: jobResult.error || "创建任务失败"
      };
    }

    return {
      success: true,
      assetId,
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

/**
 * 重新生成素材图片（创建新版本）
 * 使用现有资产的生成参数创建新版本
 */
export async function regenerateAssetImage(
  assetId: string
): Promise<GenerateAssetImageJobResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 获取现有素材
    const { getAssetWithFullData } = await import("./crud");
    const assetResult = await getAssetWithFullData(assetId);

    if (!assetResult.success || !assetResult.asset) {
      return { success: false, error: assetResult.error || "素材不存在" };
    }

    const existingAsset = assetResult.asset;

    // 验证是否可以重新生成
    if (existingAsset.sourceType !== "generated") {
      return { success: false, error: "只能重新生成 AI 生成的素材" };
    }

    if (existingAsset.assetType !== "image") {
      return { success: false, error: "此方法仅支持图片素材" };
    }

    if (!existingAsset.prompt) {
      return { success: false, error: "缺少生成参数（prompt）" };
    }

    // 创建新版本
    const { createAssetVersion } = await import("./crud");
    const versionResult = await createAssetVersion(assetId, {
      prompt: existingAsset.prompt,
      modelUsed: existingAsset.modelUsed || "nano-banana-pro",
      generationConfig: existingAsset.generationConfig || JSON.stringify({
        aspectRatio: "16:9",
        resolution: "2K",
        numImages: 1,
      }),
      sourceAssetIds: existingAsset.sourceAssetIds || undefined,
    });

    if (!versionResult.success || !versionResult.versionId) {
      return { success: false, error: versionResult.error || "创建版本失败" };
    }

    // 创建图片生成任务（关联到新版本）
    const jobResult = await createJob({
      userId: session.user.id,
      projectId: existingAsset.projectId,
      type: "asset_image",
      assetId: assetId,
      imageDataId: versionResult.versionId,
      inputData: {},
    });

    if (!jobResult.success || !jobResult.jobId) {
      return { success: false, error: jobResult.error || "创建任务失败" };
    }

    return {
      success: true,
      assetId,
      jobId: jobResult.jobId,
    };
  } catch (error) {
    console.error("重新生成素材失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "重新生成失败",
    };
  }
}

/**
 * 编辑素材图片并创建新版本（图生图）
 * 与 editAssetImage 不同，这个函数会在原素材下创建新版本，而不是创建新素材
 */
export interface EditAssetImageAsVersionInput {
  assetId: string;              // 原素材 ID
  editPrompt: string;           // 编辑提示词
  sourceAssetIds?: string[];    // 额外参考图（不包含原素材自身）
  aspectRatio?: AspectRatio | "auto";    // 比例（默认继承原图）
  resolution?: ImageResolution; // 分辨率（默认继承原图）
}

export async function editAssetImageAsVersion(
  input: EditAssetImageAsVersionInput
): Promise<GenerateAssetImageJobResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const {
      assetId,
      editPrompt,
      sourceAssetIds = [],
      aspectRatio = "auto",
      resolution = "2K",
    } = input;

    // 验证参数
    if (!editPrompt || !editPrompt.trim()) {
      return { success: false, error: "请输入编辑提示词" };
    }

    // 获取原素材
    const { getAssetWithFullData } = await import("./crud");
    const assetResult = await getAssetWithFullData(assetId);

    if (!assetResult.success || !assetResult.asset) {
      return { success: false, error: assetResult.error || "素材不存在" };
    }

    const existingAsset = assetResult.asset;

    if (existingAsset.assetType !== "image") {
      return { success: false, error: "此方法仅支持图片素材" };
    }

    // 合并参考图：原素材 + 额外参考图
    const allSourceAssetIds = [assetId, ...sourceAssetIds].slice(0, 8);

    // 查询源资产的激活版本，记录版本快照
    const sourceVersionIds: string[] = [];
    for (const sourceId of allSourceAssetIds) {
      const versionId = await resolveAssetVersionId(sourceId);
      if (versionId) {
        sourceVersionIds.push(versionId);
      }
    }

    // 构建包含版本快照的 generationConfig
    const generationConfig: ImageGenerationConfig = {
      aspectRatio: aspectRatio === "auto" ? undefined : aspectRatio,
      resolution: resolution,
      numImages: 1,
    };

    if (sourceVersionIds.length > 0) {
      generationConfig._versionSnapshot = {
        source_image_version_ids: sourceVersionIds,
      };
    }

    // 创建新版本记录
    const { createAssetVersion } = await import("./crud");
    const versionResult = await createAssetVersion(assetId, {
      prompt: editPrompt.trim(),
      modelUsed: "nano-banana-pro",
      sourceAssetIds: allSourceAssetIds,
      generationConfig: JSON.stringify(generationConfig),
    });

    if (!versionResult.success || !versionResult.versionId) {
      return { success: false, error: versionResult.error || "创建版本失败" };
    }

    // 创建图片生成任务（关联到新版本）
    const jobResult = await createJob({
      userId: session.user.id,
      projectId: existingAsset.projectId,
      type: "asset_image",
      assetId: assetId,
      imageDataId: versionResult.versionId,
      inputData: {},
    });

    if (!jobResult.success || !jobResult.jobId) {
      return { success: false, error: jobResult.error || "创建任务失败" };
    }

    return {
      success: true,
      assetId,
      jobId: jobResult.jobId,
    };
  } catch (error) {
    console.error("编辑素材版本失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "编辑失败",
    };
  }
}

