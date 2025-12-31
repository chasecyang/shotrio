"use server";

import db from "@/lib/db";
import { asset } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { generateReferenceToVideo, type KlingO1ReferenceToVideoInput } from "@/lib/services/fal.service";
import { uploadVideoFromUrl } from "@/lib/actions/upload-actions";
import { updateJobProgress, completeJob } from "@/lib/actions/job";
import { spendCredits, refundCredits } from "@/lib/actions/credits/spend";
import { CREDIT_COSTS } from "@/types/payment";
import type {
  Job,
  VideoGenerationInput,
  VideoGenerationResult,
  FinalVideoExportInput,
  FinalVideoExportResult,
} from "@/types/job";
import { verifyProjectOwnership } from "../utils/validation";

/**
 * 处理视频生成任务（新架构：使用 asset 表）
 */
export async function processVideoGeneration(jobData: Job, workerToken: string): Promise<void> {
  const input: VideoGenerationInput = JSON.parse(jobData.inputData || "{}");
  const { assetId } = input; // 改为 assetId

  console.log(`[Worker] 开始生成视频: Asset ${assetId}`);

  try {
    // 验证项目所有权
    if (jobData.projectId) {
      const hasAccess = await verifyProjectOwnership(
        jobData.projectId,
        jobData.userId
      );
      if (!hasAccess) {
        throw new Error("无权访问该项目");
      }
    }

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 5,
        progressMessage: "加载配置...",
      },
      workerToken
    );

    // 1. 查询 asset 记录（assetType='video'）
    const assetData = await db.query.asset.findFirst({
      where: and(
        eq(asset.id, assetId),
        eq(asset.assetType, "video")
      ),
    });

    if (!assetData) {
      throw new Error("视频资产不存在");
    }

    if (!assetData.generationConfig) {
      throw new Error("视频生成配置不存在");
    }

    // 2. 解析 Kling O1 配置
    const klingO1Config: KlingO1ReferenceToVideoInput = JSON.parse(assetData.generationConfig);

    console.log(`[Worker] Kling O1 配置:`, {
      prompt: klingO1Config.prompt,
      elementsCount: klingO1Config.elements?.length || 0,
      globalImagesCount: klingO1Config.image_urls?.length || 0,
      duration: klingO1Config.duration,
      aspectRatio: klingO1Config.aspect_ratio,
    });

    // 3. 更新状态为 processing
    await db.update(asset)
      .set({ status: "processing" })
      .where(eq(asset.id, assetId));

    // 4. 计算积分消费
    const videoDuration = parseInt(klingO1Config.duration || "5");
    const creditsNeeded = CREDIT_COSTS.VIDEO_GENERATION_PER_SECOND * videoDuration;
    
    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 20,
        progressMessage: `检查积分余额（需要 ${creditsNeeded} 积分）...`,
      },
      workerToken
    );

    // 5. 扣除积分
    const spendResult = await spendCredits({
      userId: jobData.userId,
      amount: creditsNeeded,
      description: `生成 ${videoDuration}秒 视频（Kling O1）`,
      metadata: {
        jobId: jobData.id,
        assetId,
        projectId: jobData.projectId,
        duration: videoDuration,
        costPerSecond: CREDIT_COSTS.VIDEO_GENERATION_PER_SECOND,
      },
    });

    if (!spendResult.success) {
      throw new Error(spendResult.error || "积分不足");
    }

    const transactionId = spendResult.transactionId;

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 25,
        progressMessage: "调用 Kling O1 API 生成视频...",
      },
      workerToken
    );

    // 6. 调用 Kling O1 API
    console.log(`[Worker] 调用 Kling O1 API`);
    console.log(`[Worker] 完整配置:`, JSON.stringify(klingO1Config, null, 2));
    
    let videoResult;
    try {
      videoResult = await generateReferenceToVideo(klingO1Config);
    } catch (error) {
      // 打印详细错误信息
      console.error(`[Worker] Kling O1 API 调用失败:`, error);
      if (error && typeof error === 'object' && 'body' in error) {
        console.error(`[Worker] 错误详情:`, JSON.stringify((error as any).body, null, 2));
      }
      
      // 生成失败，退还积分
      if (transactionId) {
        await refundCredits({
          userId: jobData.userId,
          amount: creditsNeeded,
          description: `视频生成失败，退还积分`,
          metadata: {
            jobId: jobData.id,
            assetId,
            originalTransactionId: transactionId,
            reason: "generation_failed",
          },
        });
      }
      
      // 更新 asset 状态
      await db
        .update(asset)
        .set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "生成失败",
        })
        .where(eq(asset.id, assetId));
      
      throw error;
    }

    if (!videoResult.video?.url) {
      throw new Error("视频生成失败：未返回视频URL");
    }

    console.log(`[Worker] Kling O1 API 返回视频URL: ${videoResult.video.url}`);

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 85,
        progressMessage: "上传视频到存储...",
      },
      workerToken
    );

    // 7. 上传视频到 R2
    const uploadResult = await uploadVideoFromUrl(
      videoResult.video.url,
      `video-${assetId}-${Date.now()}.mp4`,
      jobData.userId
    );

    if (!uploadResult.success || !uploadResult.url) {
      // 上传失败，退还积分
      if (transactionId) {
        await refundCredits({
          userId: jobData.userId,
          amount: creditsNeeded,
          description: `视频上传失败，退还积分`,
          metadata: {
            jobId: jobData.id,
            assetId,
            originalTransactionId: transactionId,
            reason: "upload_failed",
          },
        });
      }
      
      // 更新 asset 状态为失败
      await db
        .update(asset)
        .set({
          status: "failed",
          errorMessage: `上传视频失败: ${uploadResult.error || '未知错误'}`,
        })
        .where(eq(asset.id, assetId));
      
      throw new Error(`上传视频失败: ${uploadResult.error || '未知错误'}`);
    }

    console.log(`[Worker] 视频已上传: ${uploadResult.url}`);

    // 8. 更新 asset 记录
    await db
      .update(asset)
      .set({
        videoUrl: uploadResult.url,
        duration: videoDuration * 1000, // 转换为毫秒
        status: "completed",
      })
      .where(eq(asset.id, assetId));

    const result: VideoGenerationResult = {
      videoUrl: uploadResult.url,
      duration: videoDuration,
    };

    await completeJob(
      {
        jobId: jobData.id,
        resultData: result,
      },
      workerToken
    );

    console.log(`[Worker] 视频生成完成: Asset ${assetId}`);
  } catch (error) {
    console.error(`[Worker] 生成视频失败:`, error);
    
    // 更新 asset 状态为失败（使用强错误处理）
    try {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      console.log(`[Worker] 正在更新 Asset ${assetId} 状态为 failed...`);
      
      const updateResult = await db
        .update(asset)
        .set({
          status: "failed",
          errorMessage: errorMessage,
        })
        .where(eq(asset.id, assetId))
        .returning();
      
      console.log(`[Worker] Asset ${assetId} 状态已更新为 failed`, updateResult);
    } catch (updateError) {
      console.error(`[Worker] ⚠️ 警告：更新 Asset ${assetId} 失败状态时出错:`, updateError);
      // 即使更新失败，也要继续抛出原始错误
    }
    
    throw error;
  }
}

/**
 * 处理最终成片导出
 * 注意：这是一个基础实现，生成视频列表文件
 * 实际的FFmpeg合成可以在客户端或使用专门的视频处理服务
 */
export async function processFinalVideoExport(jobData: Job, workerToken: string): Promise<void> {
  const input: FinalVideoExportInput = JSON.parse(jobData.inputData || "{}");
  const { projectId, videoIds } = input;

  console.log(`[Worker] 开始导出成片: Project ${projectId}, ${videoIds.length} 个视频片段`);

  try {
    // 验证项目所有权
    if (jobData.projectId) {
      const hasAccess = await verifyProjectOwnership(
        jobData.projectId,
        jobData.userId
      );
      if (!hasAccess) {
        throw new Error("无权访问该项目");
      }
    }

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 10,
        progressMessage: "加载视频数据...",
      },
      workerToken
    );

    // 获取所有视频资产
    const videos = await db.query.asset.findMany({
      where: (asset, { inArray, and, eq }) => and(
        inArray(asset.id, videoIds),
        eq(asset.assetType, "video")
      ),
    });

    if (videos.length === 0) {
      throw new Error("没有找到任何视频");
    }

    // 过滤出已完成的视频
    const completedVideos = videos.filter((v) => v.status === "completed" && v.videoUrl);

    if (completedVideos.length === 0) {
      throw new Error("没有已完成的视频");
    }

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 30,
        progressMessage: `找到 ${completedVideos.length} 个视频片段...`,
      },
      workerToken
    );

    // 按照 videoIds 的顺序排序
    const sortedVideos = videoIds
      .map((id) => completedVideos.find((v) => v.id === id))
      .filter((v): v is NonNullable<typeof v> => v !== undefined);

    // 计算总时长（duration 现在是毫秒，需要转换为秒）
    const totalDuration = sortedVideos.reduce((sum, v) => sum + ((v.duration || 0) / 1000), 0);

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 50,
        progressMessage: "准备导出信息...",
      },
      workerToken
    );

    // 基础实现：返回视频列表供前端处理
    const videoList = sortedVideos.map((v, index) => ({
      videoId: v.id,
      order: index + 1,
      videoUrl: v.videoUrl!,
      duration: (v.duration || 0) / 1000, // 转换为秒
    }));

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 90,
        progressMessage: "生成导出信息...",
      },
      workerToken
    );

    const result: FinalVideoExportResult = {
      projectId,
      videoUrl: "", // 暂时返回空，实际应该是合成后的视频URL
      duration: totalDuration,
      fileSize: 0, // 暂时返回0
      videoList,
    };

    await completeJob(
      {
        jobId: jobData.id,
        resultData: result,
      },
      workerToken
    );

    console.log(`[Worker] 导出完成: Project ${projectId}, ${sortedVideos.length} 个片段`);
  } catch (error) {
    console.error(`[Worker] 导出失败:`, error);
    throw error;
  }
}
