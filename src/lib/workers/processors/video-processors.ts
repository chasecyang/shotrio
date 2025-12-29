"use server";

import db from "@/lib/db";
import { shot, episode, shotVideo, shotAsset } from "@/lib/db/schemas/project";
import { eq, inArray, asc } from "drizzle-orm";
import { generateReferenceToVideo, type KlingO1ReferenceToVideoInput } from "@/lib/services/fal.service";
import { uploadVideoFromUrl } from "@/lib/actions/upload-actions";
import { updateJobProgress, completeJob, createJob } from "@/lib/actions/job";
import { buildVideoPrompt, getKlingDuration } from "@/lib/utils/motion-prompt";
import { spendCredits, refundCredits } from "@/lib/actions/credits/spend";
import { CREDIT_COSTS } from "@/types/payment";
import type {
  Job,
  ShotVideoGenerationInput,
  ShotVideoGenerationResult,
  FinalVideoExportInput,
  FinalVideoExportResult,
} from "@/types/job";
import type { Asset } from "@/types/asset";
import { verifyProjectOwnership } from "../utils/validation";

/**
 * 处理视频生成任务（旧版本兼容 - 已废弃）
 */
export async function processVideoGeneration(jobData: Job, workerToken: string): Promise<void> {
  console.warn("[Worker] processVideoGeneration 已废弃，请使用 processShotVideoGeneration");
  await processShotVideoGeneration(jobData, workerToken);
}

/**
 * 处理单镜视频生成（新架构：直接使用 Agent 提供的 Kling O1 配置）
 */
export async function processShotVideoGeneration(jobData: Job, workerToken: string): Promise<void> {
  const input: ShotVideoGenerationInput = JSON.parse(jobData.inputData || "{}");
  const { shotId, videoConfigId } = input;

  console.log(`[Worker] 开始生成视频: Shot ${shotId}, VideoConfig ${videoConfigId}`);

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

    // 1. 查询 shot_video 记录
    const shotVideoData = await db.query.shotVideo.findFirst({
      where: eq(shotVideo.id, videoConfigId),
    });

    if (!shotVideoData) {
      throw new Error("视频配置不存在");
    }

    // 2. 解析 Kling O1 配置（Agent 已经构建好的完整配置）
    const klingO1Config: KlingO1ReferenceToVideoInput = JSON.parse(shotVideoData.generationConfig);

    console.log(`[Worker] Kling O1 配置:`, {
      prompt: klingO1Config.prompt,
      elementsCount: klingO1Config.elements?.length || 0,
      globalImagesCount: klingO1Config.image_urls?.length || 0,
      duration: klingO1Config.duration,
      aspectRatio: klingO1Config.aspect_ratio,
    });

    // 3. 计算积分消费
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

    // 4. 扣除积分
    const spendResult = await spendCredits({
      userId: jobData.userId,
      amount: creditsNeeded,
      description: `生成 ${videoDuration}秒 视频（Kling O1）`,
      metadata: {
        jobId: jobData.id,
        shotId,
        videoConfigId,
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

    // 5. 直接调用 Kling O1 API（使用 Agent 提供的配置）
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
            shotId,
            videoConfigId,
            originalTransactionId: transactionId,
            reason: "generation_failed",
          },
        });
      }
      
      // 更新 shot_video 状态
      await db
        .update(shotVideo)
        .set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "生成失败",
        })
        .where(eq(shotVideo.id, videoConfigId));
      
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

    // 6. 上传视频到 R2
    const uploadResult = await uploadVideoFromUrl(
      videoResult.video.url,
      `shot-${shotId}-${videoConfigId}-${Date.now()}.mp4`,
      jobData.userId
    );

    if (!uploadResult.success || !uploadResult.url) {
      throw new Error(`上传视频失败: ${uploadResult.error || '未知错误'}`);
    }

    console.log(`[Worker] 视频已上传: ${uploadResult.url}`);

    // 7. 更新 shot_video 记录
    await db
      .update(shotVideo)
      .set({
        videoUrl: uploadResult.url,
        status: "completed",
      })
      .where(eq(shotVideo.id, videoConfigId));

    // 8. 如果 shot 还没有 currentVideoId，自动设置为这个版本
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, shotId),
    });

    if (shotData && !shotData.currentVideoId) {
      await db
        .update(shot)
        .set({ currentVideoId: videoConfigId })
        .where(eq(shot.id, shotId));
    }

    const result: ShotVideoGenerationResult = {
      shotId,
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

    console.log(`[Worker] 视频生成完成: Shot ${shotId}`);
  } catch (error) {
    console.error(`[Worker] 生成视频失败:`, error);
    
    // 更新 shot_video 状态为失败
    try {
      await db
        .update(shotVideo)
        .set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "未知错误",
        })
        .where(eq(shotVideo.id, videoConfigId));
    } catch (updateError) {
      console.error(`[Worker] 更新失败状态失败:`, updateError);
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
  const { episodeId } = input;

  console.log(`[Worker] 开始导出成片: Episode ${episodeId}`);

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
        progressMessage: "加载剧集数据...",
      },
      workerToken
    );

    // 获取剧集所有分镜
    const episodeData = await db.query.episode.findFirst({
      where: eq(episode.id, episodeId),
      with: {
        shots: true,
      },
    });

    if (!episodeData) {
      throw new Error("剧集不存在");
    }

    // 过滤出有视频的分镜
    const shotsWithVideo = episodeData.shots.filter((s) => s.videoUrl);

    if (shotsWithVideo.length === 0) {
      throw new Error("该剧集没有已生成的视频");
    }

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 30,
        progressMessage: `找到 ${shotsWithVideo.length} 个视频片段...`,
      },
      workerToken
    );

    // 计算总时长
    const totalDuration = shotsWithVideo.reduce((sum, shot) => sum + (shot.duration || 0), 0) / 1000;

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 50,
        progressMessage: "准备导出信息...",
      },
      workerToken
    );

    // 基础实现：返回视频列表供前端处理
    const videoList = shotsWithVideo.map((shot) => ({
      order: shot.order,
      videoUrl: shot.videoUrl!,
      duration: shot.duration || 3000,
      dialogues: [], // TODO: 从数据库加载对话数据
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
      episodeId,
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

    console.log(`[Worker] 导出完成: Episode ${episodeId}, ${shotsWithVideo.length} 个片段`);
  } catch (error) {
    console.error(`[Worker] 导出失败:`, error);
    throw error;
  }
}

