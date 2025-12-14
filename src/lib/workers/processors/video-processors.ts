"use server";

import db from "@/lib/db";
import { shot, episode } from "@/lib/db/schemas/project";
import { eq, inArray } from "drizzle-orm";
import { generateImageToVideo } from "@/lib/services/fal.service";
import { uploadImageFromUrl } from "@/lib/actions/upload-actions";
import { updateJobProgress, completeJob, createJob } from "@/lib/actions/job";
import { buildVideoPrompt, getKlingDuration } from "@/lib/utils/motion-prompt";
import type {
  Job,
  ShotVideoGenerationInput,
  ShotVideoGenerationResult,
  BatchVideoGenerationInput,
  BatchVideoGenerationResult,
  FinalVideoExportInput,
  FinalVideoExportResult,
} from "@/types/job";
import { verifyProjectOwnership } from "../utils/validation";

/**
 * 处理视频生成任务（旧版本兼容）
 */
export async function processVideoGeneration(jobData: Job, workerToken: string): Promise<void> {
  // 保留旧的接口作为向后兼容
  // 直接调用新的单镜视频生成
  await processShotVideoGeneration(jobData, workerToken);
}

/**
 * 处理单镜视频生成
 */
export async function processShotVideoGeneration(jobData: Job, workerToken: string): Promise<void> {
  const input: ShotVideoGenerationInput = JSON.parse(jobData.inputData || "{}");
  const { shotId, imageUrl, prompt, duration } = input;

  console.log(`[Worker] 开始生成视频: Shot ${shotId}`);

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

    // 获取分镜信息
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, shotId),
    });

    if (!shotData) {
      throw new Error("分镜不存在");
    }

    if (!imageUrl) {
      throw new Error("分镜图片不存在");
    }

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 20,
        progressMessage: "调用Kling API生成视频...",
      },
      workerToken
    );

    // 调用Kling Video API
    console.log(`[Worker] 调用Kling API: ${imageUrl}`);
    const videoResult = await generateImageToVideo({
      prompt: prompt || "camera movement, cinematic",
      image_url: imageUrl,
      duration: duration || "5",
      generate_audio: true,
    });

    if (!videoResult.video?.url) {
      throw new Error("视频生成失败：未返回视频URL");
    }

    console.log(`[Worker] Kling API返回视频URL: ${videoResult.video.url}`);

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 80,
        progressMessage: "上传视频到存储...",
      },
      workerToken
    );

    // 上传视频到R2
    const uploadResult = await uploadImageFromUrl(
      videoResult.video.url,
      `videos/shot-${shotId}-${Date.now()}.mp4`,
      jobData.userId
    );

    if (!uploadResult.success || !uploadResult.url) {
      throw new Error("上传视频失败");
    }

    console.log(`[Worker] 视频已上传: ${uploadResult.url}`);

    // 更新分镜记录
    await db
      .update(shot)
      .set({
        videoUrl: uploadResult.url,
        updatedAt: new Date(),
      })
      .where(eq(shot.id, shotId));

    const result: ShotVideoGenerationResult = {
      shotId,
      videoUrl: uploadResult.url,
      duration: parseInt(duration || "5"),
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
    throw error;
  }
}

/**
 * 处理批量视频生成
 */
export async function processBatchVideoGeneration(jobData: Job, workerToken: string): Promise<void> {
  const input: BatchVideoGenerationInput = JSON.parse(jobData.inputData || "{}");
  const { shotIds } = input;

  console.log(`[Worker] 开始批量生成视频: ${shotIds.length} 个分镜`);

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

    // 获取所有分镜信息
    const shots = await db.query.shot.findMany({
      where: inArray(shot.id, shotIds),
    });

    if (shots.length === 0) {
      throw new Error("未找到要生成的分镜");
    }

    const results: BatchVideoGenerationResult["results"] = [];
    let successCount = 0;
    let failedCount = 0;

    // 为每个分镜创建子任务
    for (let i = 0; i < shots.length; i++) {
      const shotData = shots[i];
      
      await updateJobProgress(
        {
          jobId: jobData.id,
          progress: Math.floor((i / shots.length) * 90),
          currentStep: i + 1,
          progressMessage: `正在生成第 ${i + 1}/${shots.length} 个视频...`,
        },
        workerToken
      );

      try {
        if (!shotData.imageUrl) {
          results.push({
            shotId: shotData.id,
            success: false,
            error: "分镜没有图片",
          });
          failedCount++;
          continue;
        }

        // 创建子任务
        const videoPrompt = buildVideoPrompt({
          visualPrompt: shotData.visualPrompt || undefined,
          cameraMovement: shotData.cameraMovement,
        });

        const childJobResult = await createJob({
          userId: jobData.userId,
          projectId: jobData.projectId || undefined,
          type: "shot_video_generation",
          inputData: {
            shotId: shotData.id,
            imageUrl: shotData.imageUrl,
            prompt: videoPrompt,
            duration: getKlingDuration(shotData.duration || 3000),
          } as ShotVideoGenerationInput,
          parentJobId: jobData.id,
        });

        if (childJobResult.success) {
          results.push({
            shotId: shotData.id,
            success: true,
          });
          successCount++;
        } else {
          results.push({
            shotId: shotData.id,
            success: false,
            error: childJobResult.error,
          });
          failedCount++;
        }
      } catch (error) {
        console.error(`[Worker] 生成视频失败 (Shot ${shotData.id}):`, error);
        results.push({
          shotId: shotData.id,
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        });
        failedCount++;
      }
    }

    const batchResult: BatchVideoGenerationResult = {
      results,
      totalCount: shots.length,
      successCount,
      failedCount,
    };

    await completeJob(
      {
        jobId: jobData.id,
        resultData: batchResult,
      },
      workerToken
    );

    console.log(`[Worker] 批量生成完成: ${successCount} 成功, ${failedCount} 失败`);
  } catch (error) {
    console.error(`[Worker] 批量生成视频失败:`, error);
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
      // 返回视频列表供前端使用
      videoList: videoList as any,
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

