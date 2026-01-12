"use server";

import { randomUUID } from "crypto";
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
import { asset, imageData } from "@/lib/db/schemas/project";
import { inArray, eq, and } from "drizzle-orm";

/**
 * 处理素材图片生成任务
 * 从 imageData 版本记录读取所有生成信息
 */
export async function processAssetImageGeneration(
  jobData: Job,
  workerToken: string
): Promise<void> {
  // 优先从 imageDataId 读取版本 ID，回退到 assetId（迁移兼容）
  const imageDataId = jobData.imageDataId;
  const assetId = jobData.assetId;

  if (!imageDataId && !assetId) {
    throw new Error("Job 缺少 imageDataId 或 assetId 关联");
  }

  try {
    await processAssetImageGenerationInternal(jobData, workerToken, assetId!, imageDataId);
  } catch (error) {
    console.error(`[Worker] 图片生成任务失败:`, error);

    // 注意：不再手动更新asset状态，状态从job自动计算
    // job会在外层被标记为failed，asset状态会自动反映失败

    throw error;
  }
}

async function processAssetImageGenerationInternal(
  jobData: Job,
  workerToken: string,
  assetId: string,
  imageDataId?: string | null
): Promise<void> {

  // 从 asset 和 imageData 读取所有生成信息
  await updateJobProgress(
    {
      jobId: jobData.id,
      progress: 5,
      progressMessage: "读取素材信息...",
    },
    workerToken
  );

  // 查询 asset 获取基本信息
  const assetData = await db.query.asset.findFirst({
    where: eq(asset.id, assetId),
    with: {
      tags: true,
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

  // 从 imageData 读取生成参数
  let prompt: string | null = null;
  let sourceAssetIds: string[] = [];
  let generationConfig: string | null = null;

  if (imageDataId) {
    // 通过 imageDataId 查询（优先）
    const imageDataRecord = await db.query.imageData.findFirst({
      where: eq(imageData.id, imageDataId),
    });

    if (imageDataRecord) {
      prompt = imageDataRecord.prompt;
      sourceAssetIds = imageDataRecord.sourceAssetIds || [];
      generationConfig = imageDataRecord.generationConfig;
    }
  } else if (assetId) {
    // fallback：通过 assetId 查询激活版本
    const imageDataRecord = await db.query.imageData.findFirst({
      where: and(eq(imageData.assetId, assetId), eq(imageData.isActive, true)),
    });

    if (imageDataRecord) {
      prompt = imageDataRecord.prompt;
      sourceAssetIds = imageDataRecord.sourceAssetIds || [];
      generationConfig = imageDataRecord.generationConfig;
    }
  }

  if (!prompt) {
    throw new Error("缺少 prompt（imageData）");
  }

  const projectId = assetData.projectId;
  const assetName = assetData.name;
  const assetTags = assetData.tags.map((t: { tagValue: string }) => t.tagValue);

  // 从 meta 或 generationConfig 中读取生成参数
  let aspectRatio = "16:9";
  let numImages = 1;
  let versionSnapshot: { source_image_version_ids?: string[] } | undefined;

  // 优先从 generationConfig 读取（新架构）
  if (generationConfig) {
    try {
      const config = JSON.parse(generationConfig);
      aspectRatio = config.aspectRatio || aspectRatio;
      numImages = config.numImages || numImages;
      // 提取版本快照
      versionSnapshot = config._versionSnapshot;
    } catch {
      // ignore
    }
  } else {
    // 回退到 meta（迁移兼容）
    try {
      const meta = assetData.meta ? JSON.parse(assetData.meta) : null;
      const generationParams = meta?.generationParams || {};
      aspectRatio = generationParams.aspectRatio || aspectRatio;
      numImages = generationParams.numImages || numImages;
    } catch {
      // ignore
    }
  }
  
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
    description: `descriptions.generation.images`,
    metadata: {
      jobId: jobData.id,
      projectId,
      numImages,
      costPerImage: CREDIT_COSTS.IMAGE_GENERATION,
      translationParams: { count: numImages },
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
          imageDataList: true,
        },
      });

      if (sourceAssets.length === 0) {
        throw new Error("未找到源素材");
      }

      // 获取源图片 URL（优先使用版本快照，回退到激活版本）
      const imageUrls: string[] = [];
      const snapshotVersionIds = versionSnapshot?.source_image_version_ids || [];

      for (let i = 0; i < sourceAssetIds.length; i++) {
        const sourceId = sourceAssetIds[i];
        const sourceAsset = sourceAssets.find((a) => a.id === sourceId);
        if (!sourceAsset) continue;

        const imageDataList = sourceAsset.imageDataList as Array<{
          id: string;
          isActive: boolean;
          imageUrl: string | null;
        }>;

        // 优先使用版本快照中指定的版本
        const snapshotVersionId = snapshotVersionIds[i];
        let targetImageData;

        if (snapshotVersionId) {
          targetImageData = imageDataList?.find((v) => v.id === snapshotVersionId);
          if (targetImageData?.imageUrl) {
            console.log(`[Worker] 使用版本快照: ${snapshotVersionId}`);
          } else if (targetImageData) {
            console.warn(
              `[Worker] 版本 ${snapshotVersionId} 无图片，回退到激活版本`
            );
            targetImageData = undefined;
          } else {
            console.warn(
              `[Worker] 版本 ${snapshotVersionId} 不存在，回退到激活版本`
            );
          }
        }

        // 回退到激活版本
        if (!targetImageData) {
          targetImageData = imageDataList?.find((v) => v.isActive);
        }

        if (targetImageData?.imageUrl) {
          imageUrls.push(targetImageData.imageUrl);
        }
      }

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
        description: `descriptions.refund.image_generation_failed`,
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
          description: `descriptions.refund.image_upload_failed`,
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

    // 更新 imageData 版本记录
    if (imageDataId) {
      // 先将所有版本设为非激活
      await db
        .update(imageData)
        .set({ isActive: false })
        .where(eq(imageData.assetId, assetId));

      // 更新当前版本并激活
      await db
        .update(imageData)
        .set({
          imageUrl: uploadResult.url,
          thumbnailUrl: uploadResult.url,
          modelUsed: "nano-banana-pro",
          isActive: true,
        })
        .where(eq(imageData.id, imageDataId));
    } else {
      // 查找现有 imageData 或创建新记录
      const existingImageData = await db.query.imageData.findFirst({
        where: eq(imageData.assetId, assetId),
      });

      if (existingImageData) {
        await db
          .update(imageData)
          .set({
            imageUrl: uploadResult.url,
            thumbnailUrl: uploadResult.url,
            modelUsed: "nano-banana-pro",
          })
          .where(eq(imageData.id, existingImageData.id));
      } else {
        await db.insert(imageData).values({
          id: randomUUID(),
          assetId: assetId,
          imageUrl: uploadResult.url,
          thumbnailUrl: uploadResult.url,
          modelUsed: "nano-banana-pro",
          isActive: true,
        });
      }
    }

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
