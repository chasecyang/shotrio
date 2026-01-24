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
import { createVideoAsset } from "@/lib/actions/asset";
import { createJob } from "@/lib/actions/job";

/**
 * 获取项目的画风prompt
 */
async function getProjectStylePrompt(projectId: string): Promise<string | null> {
  const projectData = await db.query.project.findFirst({
    where: eq(project.id, projectId),
  });
  return projectData?.stylePrompt || null;
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
      return handleGenerateVideo(functionCall, projectId);
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
  projectId: string
): Promise<FunctionExecutionResult> {
  const { parameters } = functionCall;
  const title = parameters.title as string | undefined;
  const tags = parameters.tags as string[] | undefined;
  const order = parameters.order as number | undefined;

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
      type: "reference-to-video",
      prompt: finalPrompt,
      reference_image_urls: normalizedConfig.reference_image_urls as string[],
      aspect_ratio: normalizedConfig.aspect_ratio as "16:9" | "9:16" | undefined,
      negative_prompt: normalizedConfig.negative_prompt as string | undefined,
      duration: normalizedConfig.duration as "10" | "15" | undefined,
    };

    // ========== 创建新素材模式 ==========
    const generateResult = await createVideoAsset({
      projectId,
      name: title || "未命名视频",
      prompt: finalPrompt,
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
