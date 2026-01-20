"use server";

/**
 * 图片/视频生成处理器
 *
 * 处理 generate_image_asset, generate_video_asset
 */

import type { FunctionCall, FunctionExecutionResult } from "@/types/agent";
import db from "@/lib/db";
import { project } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import type { ArtStyle } from "@/types/art-style";
import { createVideoAsset, getAssetWithFullData } from "@/lib/actions/asset";
import { createJob } from "@/lib/actions/job";

/**
 * 获取项目的画风prompt
 */
async function getProjectStylePrompt(projectId: string): Promise<string | null> {
  const projectData = await db.query.project.findFirst({
    where: eq(project.id, projectId),
    with: { artStyle: true },
  });
  const artStyleData = projectData?.artStyle as ArtStyle | null;
  return artStyleData?.prompt || projectData?.stylePrompt || null;
}

/**
 * 统一的生成类处理器
 */
export async function handleGenerationFunctions(
  functionCall: FunctionCall,
  projectId: string,
  userId: string
): Promise<FunctionExecutionResult> {
  const { name } = functionCall;

  switch (name) {
    case "generate_image_asset":
      return handleGenerateImage(functionCall, projectId, userId);
    case "generate_video_asset":
      return handleGenerateVideo(functionCall, projectId, userId);
    default:
      return {
        functionCallId: functionCall.id,
        success: false,
        error: `未知的生成函数: ${name}`,
      };
  }
}

/**
 * 生成图片资产
 */
async function handleGenerateImage(
  functionCall: FunctionCall,
  projectId: string,
  userId: string
): Promise<FunctionExecutionResult> {
  const { parameters } = functionCall;
  const assets = parameters.assets as Array<{
    name?: string;
    prompt: string;
    tags?: string[];
    sourceAssetIds?: string[];
  }>;
  const targetAssetId = parameters.targetAssetId as string | undefined;

  // ========== 重新生成模式 ==========
  if (targetAssetId) {
    const existingAsset = await getAssetWithFullData(targetAssetId);
    if (!existingAsset.success || !existingAsset.asset) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: `素材 ${targetAssetId} 不存在`,
      };
    }
    if (existingAsset.asset.assetType !== "image") {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: `素材 ${targetAssetId} 不是图片类型，无法重新生成`,
      };
    }

    const assetData = assets[0];
    if (!assetData?.prompt) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: "重新生成模式需要在 assets 数组中提供 prompt",
      };
    }

    // 获取项目画风并前置拼接到 prompt
    const stylePrompt = await getProjectStylePrompt(projectId);
    const finalPrompt = stylePrompt
      ? `${stylePrompt}. ${assetData.prompt}`
      : assetData.prompt;

    // 创建新版本记录
    const { createAssetVersion } = await import("@/lib/actions/asset/version");
    const versionResult = await createAssetVersion(
      targetAssetId,
      {
        prompt: finalPrompt,
        modelUsed: "nano-banana-pro",
        sourceAssetIds: assetData.sourceAssetIds,
        generationConfig: JSON.stringify({
          aspectRatio: "16:9",
          numImages: 1,
        }),
      },
      { activateImmediately: false }
    );

    if (!versionResult.success || !versionResult.versionId) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: versionResult.error || "创建新版本失败",
      };
    }

    // 创建 job 关联新版本
    const jobResult = await createJob({
      userId,
      projectId,
      type: "asset_image",
      assetId: targetAssetId,
      imageDataId: versionResult.versionId,
      inputData: { activateOnComplete: true },
    });

    if (jobResult.success && jobResult.jobId) {
      return {
        functionCallId: functionCall.id,
        success: true,
        data: {
          message: `正在为素材"${existingAsset.asset.name}"生成新版本`,
          assetId: targetAssetId,
          versionId: versionResult.versionId,
          jobId: jobResult.jobId,
          isRegeneration: true,
        },
      };
    } else {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: jobResult.error || "创建生成任务失败",
      };
    }
  }

  // ========== 创建新素材模式 ==========
  const jobIds: string[] = [];
  const assetIds: string[] = [];
  const errors: string[] = [];

  const stylePrompt = await getProjectStylePrompt(projectId);
  const { createAssetInternal } = await import("@/lib/actions/asset/base-crud");

  for (const assetData of assets) {
    try {
      const assetName = assetData.name || `AI生成-${Date.now()}`;
      const finalPrompt = stylePrompt
        ? `${stylePrompt}. ${assetData.prompt}`
        : assetData.prompt;

      const createResult = await createAssetInternal({
        projectId,
        userId,
        name: assetName,
        assetType: "image",
        sourceType: "generated",
        tags: assetData.tags,
        imageData: {
          prompt: finalPrompt,
          modelUsed: "nano-banana-pro",
          sourceAssetIds: assetData.sourceAssetIds,
          generationConfig: JSON.stringify({
            aspectRatio: "16:9",
            numImages: 1,
          }),
        },
        meta: {
          generationParams: {
            aspectRatio: "16:9" as "16:9" | "1:1" | "9:16",
            numImages: 1,
          },
        },
      });

      if (!createResult.success || !createResult.asset) {
        errors.push(`创建素材 ${assetName} 失败: ${createResult.error}`);
        continue;
      }

      const assetId = createResult.asset.id;
      assetIds.push(assetId);

      const jobResult = await createJob({
        userId,
        projectId,
        type: "asset_image",
        assetId: assetId,
        imageDataId: createResult.imageDataId,
        inputData: {},
      });

      if (jobResult.success && jobResult.jobId) {
        jobIds.push(jobResult.jobId);
      } else {
        errors.push(
          `创建 "${assetData.name || "unnamed"}" 任务失败: ${jobResult.error || "未知错误"}`
        );
      }
    } catch (error) {
      console.error(`处理素材 ${assetData.name || "unnamed"} 失败:`, error);
      errors.push(
        `处理素材 "${assetData.name || "unnamed"}" 失败: ${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  }

  return {
    functionCallId: functionCall.id,
    success: jobIds.length > 0,
    data: {
      jobIds,
      assetIds,
      createdCount: jobIds.length,
      totalCount: assets.length,
      errors: errors.length > 0 ? errors : undefined,
    },
    error:
      errors.length > 0 && jobIds.length === 0
        ? `所有任务创建失败: ${errors.join("; ")}`
        : undefined,
  };
}

/**
 * 生成视频资产
 */
async function handleGenerateVideo(
  functionCall: FunctionCall,
  projectId: string,
  userId: string
): Promise<FunctionExecutionResult> {
  const { parameters } = functionCall;
  const title = parameters.title as string | undefined;
  const referenceAssetIds = parameters.referenceAssetIds as string[] | undefined;
  const tags = parameters.tags as string[] | undefined;
  const order = parameters.order as number | undefined;
  const targetAssetId = parameters.targetAssetId as string | undefined;

  try {
    // 使用统一校验
    const { validateFunctionParameters } = await import(
      "@/lib/actions/agent/validation"
    );
    const validationResult = await validateFunctionParameters(
      "generate_video_asset",
      JSON.stringify(parameters)
    );

    if (!validationResult.valid) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: `参数校验失败: ${validationResult.errors.join("; ")}`,
      };
    }

    const normalizedConfig = validationResult.normalizedConfig!;

    // 获取项目画风
    const stylePrompt = await getProjectStylePrompt(projectId);
    const finalPrompt = stylePrompt
      ? `${stylePrompt}. ${normalizedConfig.prompt}`
      : (normalizedConfig.prompt as string);

    // 构建生成配置
    const generationConfig = {
      type: "image-to-video",
      prompt: finalPrompt,
      start_image_url: normalizedConfig.start_image_url as string,
      end_image_url: normalizedConfig.end_image_url as string | undefined,
      aspect_ratio: normalizedConfig.aspect_ratio as "16:9" | "9:16" | undefined,
      negative_prompt: normalizedConfig.negative_prompt as string | undefined,
    };

    // ========== 重新生成模式 ==========
    if (targetAssetId) {
      const existingAsset = await getAssetWithFullData(targetAssetId);
      if (!existingAsset.success || !existingAsset.asset) {
        return {
          functionCallId: functionCall.id,
          success: false,
          error: `素材 ${targetAssetId} 不存在`,
        };
      }
      if (existingAsset.asset.assetType !== "video") {
        return {
          functionCallId: functionCall.id,
          success: false,
          error: `素材 ${targetAssetId} 不是视频类型，无法重新生成`,
        };
      }

      const { createAssetVersion } = await import("@/lib/actions/asset/version");
      const versionResult = await createAssetVersion(
        targetAssetId,
        {
          prompt: finalPrompt,
          modelUsed: "veo3",
          sourceAssetIds: referenceAssetIds,
          generationConfig: JSON.stringify(generationConfig),
        },
        { activateImmediately: false }
      );

      if (!versionResult.success || !versionResult.versionId) {
        return {
          functionCallId: functionCall.id,
          success: false,
          error: versionResult.error || "创建新版本失败",
        };
      }

      const jobResult = await createJob({
        userId,
        projectId,
        type: "asset_video",
        assetId: targetAssetId,
        videoDataId: versionResult.versionId,
        inputData: { activateOnComplete: true },
      });

      if (jobResult.success && jobResult.jobId) {
        return {
          functionCallId: functionCall.id,
          success: true,
          data: {
            message: `正在为视频"${existingAsset.asset.name}"生成新版本`,
            assetId: targetAssetId,
            versionId: versionResult.versionId,
            jobId: jobResult.jobId,
            isRegeneration: true,
          },
        };
      } else {
        return {
          functionCallId: functionCall.id,
          success: false,
          error: jobResult.error || "创建生成任务失败",
        };
      }
    }

    // ========== 创建新素材模式 ==========
    const generateResult = await createVideoAsset({
      projectId,
      name: title || "未命名视频",
      prompt: finalPrompt,
      referenceAssetIds,
      generationConfig,
      order,
      tags,
    });

    if (generateResult.success) {
      return {
        functionCallId: functionCall.id,
        success: true,
        data: {
          assetId: generateResult.data?.asset.id,
          jobId: generateResult.data?.jobId,
          message: "视频生成任务已创建",
        },
      };
    } else {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: generateResult.error || "创建视频生成任务失败",
      };
    }
  } catch (error) {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: error instanceof Error ? error.message : "生成视频失败",
    };
  }
}
