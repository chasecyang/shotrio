"use server";

import db from "@/lib/db";
import { updateJobProgress, completeJob } from "@/lib/actions/job";
import { verifyProjectOwnership } from "../utils/validation";
import { generateImage, editImage } from "@/lib/services/image.service";
import { uploadImageToR2, AssetCategory } from "@/lib/storage/r2.service";
import { spendCredits, refundCredits } from "@/lib/actions/credits/spend";
import { CREDIT_COSTS } from "@/types/payment";
import type {
  Job,
  AssetImageGenerationResult,
} from "@/types/job";
import type { AspectRatio } from "@/lib/services/image.service";
import { asset, generationInfo, imageData } from "@/lib/db/schemas/project";
import { inArray, eq } from "drizzle-orm";

/**
 * 处理素材图片生成任务
 * 从 asset 读取所有生成信息
 */
export async function processAssetImageGeneration(
  jobData: Job,
  workerToken: string
): Promise<void> {
  // 从外键读取 assetId
  if (!jobData.assetId) {
    throw new Error("Job 缺少 assetId 关联");
  }

  const assetId = jobData.assetId;

  try {
    await processAssetImageGenerationInternal(jobData, workerToken, assetId);
  } catch (error) {
    console.error(`[Worker] 图片生成任务失败:`, error);
    
    // 注意：不再手动更新asset状态，状态从job自动计算
    // job会在外层被标记为failed，asset状态会自动反映失败
    // ❌ 已移除：手动更新asset.status和errorMessage
    
    throw error;
  }
}

async function processAssetImageGenerationInternal(
  jobData: Job,
  workerToken: string,
  assetId: string
): Promise<void> {

  // 从 asset 读取所有生成信息
  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 5,
      progressMessage: "读取素材信息...",
    },
    workerToken
  );

  // 查询 asset 获取生成所需的所有信息（加载扩展表）
  const assetData = await db.query.asset.findFirst({
    where: eq(asset.id, assetId),
    with: {
      tags: true,
      generationInfo: true,
      imageData: true,
    },
  });

  if (!assetData) {
    throw new Error(`Asset ${assetId} 不存在`);
  }

  // 验证项目所有权
  if (assetData.projectId) {
    const hasAccess = await verifyProjectOwnership(assetData.projectId, jobData.userId);
    if (!hasAccess) {
      throw new Error("无权访问该项目");
    }
  }

  // 从 generationInfo 读取生成参数
  const prompt = assetData.generationInfo?.prompt;
  if (!prompt) {
    throw new Error("Asset 缺少 prompt（generationInfo）");
  }

  const projectId = assetData.projectId;
  const assetName = assetData.name;
  const assetTags = assetData.tags.map((t: { tagValue: string }) => t.tagValue);
  const sourceAssetIds = assetData.generationInfo?.sourceAssetIds || [];
  
  // 从 meta 中读取生成参数
  let meta = null;
  try {
    meta = assetData.meta ? JSON.parse(assetData.meta) : null;
  } catch {
    meta = null;
  }
  
  const generationParams = meta?.generationParams || {};
  const aspectRatio = generationParams.aspectRatio || "16:9";
  const numImages = generationParams.numImages || 1;
  
  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 10,
      progressMessage: "准备生成图片...",
    },
    workerToken
  );

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
    userId: jobData.userId,
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
      // 图生图模式：获取源素材的图片URL（从 imageData 表读取）
      const sourceAssets = await db.query.asset.findMany({
        where: inArray(asset.id, sourceAssetIds),
        with: {
          imageData: true,
        },
      });

      if (sourceAssets.length === 0) {
        throw new Error("未找到源素材");
      }

      const imageUrls = sourceAssets
        .map((a) => a.imageData?.imageUrl)
        .filter((url): url is string => url !== null && url !== undefined);

      if (imageUrls.length === 0) {
        throw new Error("源素材没有图片");
      }

      // 调用图生图API
      const editResult = await editImage({
        prompt: prompt.trim(),
        image_urls: imageUrls,
        num_images: numImages,
        aspect_ratio: aspectRatio === "auto" ? undefined : (aspectRatio as AspectRatio),
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
    
    // 注意：不再手动更新asset状态，状态从job自动计算
    // job会在外层被标记为failed，asset状态会自动反映失败
    
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

  // 步骤4: 上传并更新 asset（80%-95%）
  const progress = 50 + Math.floor(45);
  await updateJobProgress(
    {
      jobId: jobData.id,
      progress,
      progressMessage: `正在上传图片...`,
    },
    workerToken
  );

  // 只取第一张图片（后续如果需要批量生成可以调整）
  const generatedImage = generatedImages[0];
  
  try {
    // 上传到R2
    const uploadResult = await uploadImageToR2(generatedImage.url, {
      userId: jobData.userId,
      category: AssetCategory.PROJECTS,
    });

    if (!uploadResult.success || !uploadResult.url) {
      // 上传失败，退还积分
      if (transactionId) {
        await refundCredits({
          userId: jobData.userId,
          amount: totalCreditsNeeded,
          description: `图片上传失败，退还积分`,
          metadata: {
            jobId: jobData.id,
            originalTransactionId: transactionId,
            reason: "upload_failed",
          },
        });
      }
      
      // 注意：不再手动更新asset状态，状态从job自动计算
      // ❌ 已移除：手动更新asset.status和errorMessage
      
      throw new Error(`上传图片失败: ${uploadResult.error}`);
    }

    // 更新扩展表（新架构：写入 imageData 和 generationInfo 表）
    // 1. 写入 imageData 表（upsert）
    await db
      .insert(imageData)
      .values({
        assetId: assetId,
        imageUrl: uploadResult.url,
        thumbnailUrl: uploadResult.url,
      })
      .onConflictDoUpdate({
        target: imageData.assetId,
        set: {
          imageUrl: uploadResult.url,
          thumbnailUrl: uploadResult.url,
        },
      });

    // 2. 更新 generationInfo 表的 modelUsed
    await db
      .update(generationInfo)
      .set({
        modelUsed: "nano-banana",
      })
      .where(eq(generationInfo.assetId, assetId));

    // 3. 更新 asset 的 updatedAt
    await db
      .update(asset)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(asset.id, assetId));

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 95,
        progressMessage: "保存完成，正在整理结果...",
      },
      workerToken
    );

    // 步骤5: 完成任务（100%）
    const resultData: AssetImageGenerationResult = {
      assets: [{
        id: assetId,
        name: assetName,
        imageUrl: uploadResult.url,
        thumbnailUrl: uploadResult.url,
        tags: assetTags,
      }],
      successCount: 1,
      failedCount: 0,
    };

    await completeJob(
      {
        jobId: jobData.id,
        resultData,
      },
      workerToken
    );
  } catch (error) {
    console.error(`上传图片失败:`, error);
    throw new Error(
      `上传图片失败: ${error instanceof Error ? error.message : "未知错误"}`
    );
  }
}
