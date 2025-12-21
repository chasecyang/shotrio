"use server";

import db from "@/lib/db";
import { updateJobProgress, completeJob } from "@/lib/actions/job";
import { verifyProjectOwnership } from "../utils/validation";
import { analyzePromptForBatch } from "@/lib/services/ai-tagging.service";
import { generateImage, editImage } from "@/lib/services/fal.service";
import { uploadImageToR2, AssetCategory } from "@/lib/storage/r2.service";
import { createAssetInternal } from "@/lib/actions/asset/crud";
import { spendCredits, refundCredits } from "@/lib/actions/credits/spend";
import { CREDIT_COSTS } from "@/types/payment";
import type {
  Job,
  AssetImageGenerationInput,
  AssetImageGenerationResult,
} from "@/types/job";
import type { AspectRatio } from "@/lib/services/fal.service";
import { asset } from "@/lib/db/schemas/project";
import { inArray } from "drizzle-orm";

/**
 * 处理素材图片生成任务
 */
export async function processAssetImageGeneration(
  jobData: Job,
  workerToken: string
): Promise<void> {
  const input: AssetImageGenerationInput = JSON.parse(
    jobData.inputData || "{}"
  );

  const {
    projectId,
    prompt,
    name: providedName,
    tags: providedTags,
    aspectRatio = "16:9",
    resolution = "2K",
    numImages = 1,
    sourceAssetIds = [],
    mode,
  } = input;

  // 验证项目所有权
  if (projectId) {
    const hasAccess = await verifyProjectOwnership(projectId, jobData.userId);
    if (!hasAccess) {
      throw new Error("无权访问该项目");
    }
  }

  // 步骤1: 获取 name/tags（优先使用传入的，否则 AI 分析）
  let finalTags: string[] = [];
  let names: string[] = [];

  if (providedName && providedTags && providedTags.length > 0) {
    // Agent 提供了完整的元数据，直接使用
    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 10,
        progressMessage: "使用提供的元数据，准备生成图片...",
      },
      workerToken
    );

    finalTags = providedTags;
    names = Array.from({ length: numImages }, (_, i) =>
      numImages > 1 ? `${providedName}-${String(i + 1).padStart(2, "0")}` : providedName
    );
  } else {
    // 没有提供完整元数据，需要 AI 分析
    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 5,
        progressMessage: "AI正在分析prompt...",
      },
      workerToken
    );

    try {
      const analysisResult = await analyzePromptForBatch(prompt, numImages);
      finalTags = providedTags?.length ? providedTags : analysisResult.baseAnalysis.tags;
      names = providedName
        ? Array.from({ length: numImages }, (_, i) =>
            numImages > 1 ? `${providedName}-${String(i + 1).padStart(2, "0")}` : providedName
          )
        : analysisResult.names;
    } catch (error) {
      console.error("AI分析失败，使用fallback:", error);
      const timestamp = Date.now();
      const fallbackName = providedName || `AI生成-${timestamp}`;
      finalTags = providedTags?.length ? providedTags : ["AI生成"];
      names = Array.from({ length: numImages }, (_, i) =>
        numImages > 1 ? `${fallbackName}-${String(i + 1).padStart(2, "0")}` : fallbackName
      );
    }

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 10,
        progressMessage: "分析完成，准备生成图片...",
      },
      workerToken
    );
  }

  // 步骤2: 扣除积分
  const totalCreditsNeeded = CREDIT_COSTS.IMAGE_GENERATION * numImages;
  
  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 15,
      progressMessage: `检查积分余额（需要 ${totalCreditsNeeded} 积分）...`,
    },
    workerToken
  );

  const spendResult = await spendCredits({
    amount: totalCreditsNeeded,
    description: `生成 ${numImages} 张图片`,
    metadata: {
      jobId: jobData.id,
      projectId,
      numImages,
      costPerImage: CREDIT_COSTS.IMAGE_GENERATION,
    },
  });

  if (!spendResult.success) {
    throw new Error(spendResult.error || "积分不足");
  }

  const transactionId = spendResult.transactionId;

  // 步骤3: 生成图片（50%）
  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 20,
      progressMessage: "正在生成图片...",
    },
    workerToken
  );

  let generatedImages: Array<{ url: string; width?: number; height?: number }> = [];

  try {
    // 有参考图时自动使用 image-to-image 模式
    if (sourceAssetIds.length > 0) {
    // 图生图模式：获取源素材的图片URL
    const sourceAssets = await db.query.asset.findMany({
      where: inArray(asset.id, sourceAssetIds),
      columns: {
        imageUrl: true,
      },
    });

    if (sourceAssets.length === 0) {
      throw new Error("未找到源素材");
    }

    const imageUrls = sourceAssets.map((a) => a.imageUrl);

    // 调用图生图API
    const editResult = await editImage({
      prompt: prompt.trim(),
      image_urls: imageUrls,
      num_images: numImages,
      aspect_ratio: aspectRatio as AspectRatio | "auto",
      resolution: resolution as "1K" | "2K" | "4K",
      output_format: "png",
    });

    if (!editResult.images || editResult.images.length === 0) {
      throw new Error("生成图片失败");
    }

    generatedImages = editResult.images;
  } else {
    // 文生图模式
    const generateResult = await generateImage({
      prompt: prompt.trim(),
      num_images: numImages,
      aspect_ratio: aspectRatio as AspectRatio,
      resolution: resolution as "1K" | "2K" | "4K",
      output_format: "png",
    });

    if (!generateResult.images || generateResult.images.length === 0) {
      throw new Error("生成图片失败");
    }

    generatedImages = generateResult.images;
  }
  } catch (error) {
    console.error("[Worker] 图片生成失败:", error);
    
    // 生成失败，退还积分
    if (transactionId) {
      await refundCredits({
        userId: jobData.userId,
        amount: totalCreditsNeeded,
        description: `图片生成失败，退还积分`,
        metadata: {
          jobId: jobData.id,
          originalTransactionId: transactionId,
          reason: "generation_failed",
        },
      });
    }
    
    throw error;
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 50,
      progressMessage: `成功生成 ${generatedImages.length} 张图片`,
    },
    workerToken
  );

  // 步骤4: 上传并保存（80%-95%）
  const createdAssets: Array<{
    id: string;
    name: string;
    imageUrl: string;
    thumbnailUrl?: string;
    tags: string[];
  }> = [];
  const errors: string[] = [];

  for (let i = 0; i < generatedImages.length; i++) {
    const generatedImage = generatedImages[i];
    const assetName = names[i];

    try {
      // 计算进度：50% + (i / total) * 45%
      const progress = 50 + Math.floor((i / generatedImages.length) * 45);
      await updateJobProgress(
        {
          jobId: jobData.id,
          progress,
          progressMessage: `正在上传第 ${i + 1}/${generatedImages.length} 张图片...`,
        },
        workerToken
      );

      // 上传到R2
      const uploadResult = await uploadImageToR2(generatedImage.url, {
        userId: jobData.userId,
        category: AssetCategory.PROJECTS,
      });

      if (!uploadResult.success || !uploadResult.url) {
        errors.push(`上传第 ${i + 1} 张图片失败: ${uploadResult.error}`);
        continue;
      }

      // 确定生成模式
      const actualMode = sourceAssetIds.length > 0 ? "image-to-image" : (mode || "text-to-image");

      // 创建素材记录
      const createResult = await createAssetInternal({
        projectId,
        userId: jobData.userId,
        name: assetName,
        imageUrl: uploadResult.url,
        thumbnailUrl: uploadResult.url,
        prompt: prompt.trim(),
        modelUsed: "nano-banana",
        sourceAssetId: sourceAssetIds.length > 0 ? sourceAssetIds[0] : undefined,
        derivationType: actualMode === "image-to-image" ? "img2img" : "generate",
        tags: finalTags,
      });

      if (createResult.success && createResult.asset) {
        createdAssets.push({
          id: createResult.asset.id,
          name: createResult.asset.name,
          imageUrl: createResult.asset.imageUrl,
          thumbnailUrl: createResult.asset.thumbnailUrl || undefined,
          tags: finalTags,
        });
      } else {
        errors.push(`保存第 ${i + 1} 张图片失败: ${createResult.error}`);
      }
    } catch (error) {
      console.error(`处理第 ${i + 1} 张图片失败:`, error);
      errors.push(
        `处理第 ${i + 1} 张图片失败: ${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  }

  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 95,
      progressMessage: "保存完成，正在整理结果...",
    },
    workerToken
  );

  // 步骤5: 完成任务（100%）
  if (createdAssets.length === 0) {
    throw new Error(`所有图片生成失败: ${errors.join("; ")}`);
  }

  const resultData: AssetImageGenerationResult = {
    assets: createdAssets,
    successCount: createdAssets.length,
    failedCount: errors.length,
    errors: errors.length > 0 ? errors : undefined,
  };

  await completeJob(
    {
      jobId: jobData.id,
      resultData,
    },
    workerToken
  );
}

