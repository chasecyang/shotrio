"use server";

import db from "@/lib/db";
import { asset, generationInfo, videoData } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { generateVideo, getVideoServiceProvider } from "@/lib/services/video-service";
import { uploadVideoFromUrl } from "@/lib/actions/upload-actions";
import { updateJobProgress, completeJob } from "@/lib/actions/job";
import { spendCredits, refundCredits } from "@/lib/actions/credits/spend";
import { CREDIT_COSTS } from "@/types/payment";
import type {
  Job,
  VideoGenerationResult,
  FinalVideoExportInput,
  FinalVideoExportResult,
} from "@/types/job";
import type { VideoGenerationConfig } from "@/types/asset";
import { verifyProjectOwnership } from "../utils/validation";
import { extractVideoThumbnail } from "@/lib/utils/video-thumbnail";

/**
 * 处理视频生成任务（新架构：使用 asset 表）
 */
export async function processVideoGeneration(jobData: Job, workerToken: string): Promise<void> {
  // 从外键读取 assetId
  if (!jobData.assetId) {
    throw new Error("Job 缺少 assetId 关联");
  }
  
  const assetId = jobData.assetId;

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

    // 1. 查询 asset 记录（assetType='video'，加载扩展表）
    const assetData = await db.query.asset.findFirst({
      where: and(
        eq(asset.id, assetId),
        eq(asset.assetType, "video")
      ),
      with: {
        generationInfo: true,
        videoData: true,
      },
    });

    if (!assetData) {
      throw new Error("视频资产不存在");
    }

    if (!assetData.generationInfo?.generationConfig) {
      throw new Error("视频生成配置不存在（generationInfo）");
    }

    // 2. 解析视频生成配置（从 generationInfo 表读取）
    const config: VideoGenerationConfig = JSON.parse(assetData.generationInfo.generationConfig);
    
    // 向后兼容：如果没有 type 字段，默认为 reference-to-video
    const type = config.type || "reference-to-video";

    console.log(`[Worker] 视频生成类型: ${type}`);
    console.log(`[Worker] 配置:`, {
      type,
      prompt: config.prompt,
      duration: config.duration,
      aspectRatio: config.aspect_ratio,
    });

    // 注意：不需要手动更新asset状态为processing
    // 状态从关联的job动态计算，job已经在startJob时被设置为processing

    // 3. 计算积分消费
    const videoDuration = parseInt(config.duration || "5");
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
      description: `生成 ${videoDuration}秒 视频（${type}）`,
      metadata: {
        jobId: jobData.id,
        assetId,
        projectId: jobData.projectId,
        duration: videoDuration,
        type,
        costPerSecond: CREDIT_COSTS.VIDEO_GENERATION_PER_SECOND,
      },
    });

    if (!spendResult.success) {
      throw new Error(spendResult.error || "积分不足");
    }

    const transactionId = spendResult.transactionId;

    // 获取当前视频服务提供商
    const provider = getVideoServiceProvider();

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 25,
        progressMessage: `调用 ${provider === "veo" ? "Veo 3.1" : "Kling"} API 生成视频（${type}）...`,
      },
      workerToken
    );

    // 5. 调用统一的视频生成服务
    console.log(`[Worker] 使用 ${provider} 服务生成视频 (${type})`);
    console.log(`[Worker] 完整配置:`, JSON.stringify(config, null, 2));
    
    let videoResult;
    try {
      // 使用统一的视频服务接口
      videoResult = await generateVideo(config);
    } catch (error) {
      // 打印详细错误信息
      console.error(`[Worker] ${provider} API 调用失败 (${type}):`, error);
      if (error && typeof error === 'object' && 'body' in error) {
        console.error(`[Worker] 错误详情:`, JSON.stringify((error as any).body, null, 2));
      }
      
      // 生成失败，退还积分
      if (transactionId) {
        await refundCredits({
          userId: jobData.userId,
          amount: creditsNeeded,
          description: `视频生成失败（${type}），退还积分`,
          metadata: {
            jobId: jobData.id,
            assetId,
            originalTransactionId: transactionId,
            reason: "generation_failed",
            type,
            provider,
          },
        });
      }
      
      // 注意：不再手动更新asset状态，状态从job自动计算
      // job会在外层被标记为failed，asset状态会自动反映失败
      
      throw error;
    }

    if (!videoResult.videoUrl) {
      throw new Error("视频生成失败：未返回视频URL");
    }

    console.log(`[Worker] ${provider} API (${type}) 返回视频URL: ${videoResult.videoUrl}`);

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
      videoResult.videoUrl,
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
      
      // 注意：不再手动更新asset状态，状态从job自动计算
      // job会在外层被标记为failed，asset状态会自动反映失败
      
      throw new Error(`上传视频失败: ${uploadResult.error || '未知错误'}`);
    }

    console.log(`[Worker] 视频已上传: ${uploadResult.url}`);

    // 8. 提取视频缩略图（不阻塞流程）
    let thumbnailUrl: string | undefined;
    try {
      await updateJobProgress(
        {
          jobId: jobData.id,
          progress: 90,
          progressMessage: "生成视频缩略图...",
        },
        workerToken
      );

      const thumbnailResult = await extractVideoThumbnail(
        uploadResult.url,
        jobData.userId
      );

      if (thumbnailResult.success && thumbnailResult.thumbnailUrl) {
        thumbnailUrl = thumbnailResult.thumbnailUrl;
        console.log(`[Worker] 缩略图生成成功: ${thumbnailUrl}`);
      } else {
        console.warn(`[Worker] 缩略图生成失败: ${thumbnailResult.error}`);
        // 缩略图生成失败不影响视频本身的可用性
      }
    } catch (thumbnailError) {
      console.error(`[Worker] 缩略图生成异常:`, thumbnailError);
      // 缩略图生成失败不影响视频本身的可用性
    }

    // 9. 更新扩展表（新架构：写入 videoData 表）
    // 注意：状态现在从job动态计算，不需要手动更新
    await db
      .insert(videoData)
      .values({
        assetId: assetId,
        videoUrl: uploadResult.url,
        thumbnailUrl: thumbnailUrl || null,
        duration: videoDuration * 1000, // 转换为毫秒
      })
      .onConflictDoUpdate({
        target: videoData.assetId,
        set: {
          videoUrl: uploadResult.url,
          thumbnailUrl: thumbnailUrl || null,
          duration: videoDuration * 1000,
        },
      });

    // 更新 asset 的 updatedAt
    await db
      .update(asset)
      .set({
        updatedAt: new Date(),
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
    
    // 注意：不再手动更新asset状态，状态从job自动计算
    // job会在外层被标记为failed，asset状态会自动反映失败
    // ❌ 已移除：手动更新asset.status和errorMessage
    
    throw error;
  }
}

/**
 * 处理最终成片导出
 * 注意：这是一个基础实现，生成视频列表文件
 * 实际的FFmpeg合成可以在客户端或使用专门的视频处理服务
 */
export async function processFinalVideoExport(jobData: Job, workerToken: string): Promise<void> {
  // 严格验证输入数据
  const input = jobData.inputData as FinalVideoExportInput | null;
  
  if (!input || !input.projectId || !input.videoIds || !Array.isArray(input.videoIds)) {
    throw new Error("Job 格式错误：缺少 projectId 或 videoIds");
  }
  
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

    // 获取所有视频资产（加载 videoData 扩展表）
    const videos = await db.query.asset.findMany({
      where: (asset, { inArray, and, eq }) => and(
        inArray(asset.id, videoIds),
        eq(asset.assetType, "video")
      ),
      with: {
        videoData: true,
      },
    });

    if (videos.length === 0) {
      throw new Error("没有找到任何视频");
    }

    // 过滤出已完成的视频（有 videoUrl 的视频）
    // 注意：videoUrl 现在在 videoData 表中
    const completedVideos = videos.filter((v) => v.videoData?.videoUrl);

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

    // 计算总时长（duration 现在在 videoData 表中，是毫秒，需要转换为秒）
    const totalDuration = sortedVideos.reduce((sum, v) => sum + ((v.videoData?.duration || 0) / 1000), 0);

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 50,
        progressMessage: "准备导出信息...",
      },
      workerToken
    );

    // 基础实现：返回视频列表供前端处理（从 videoData 读取）
    const videoList = sortedVideos.map((v, index) => ({
      videoId: v.id,
      order: index + 1,
      videoUrl: v.videoData!.videoUrl!,
      duration: (v.videoData?.duration || 0) / 1000, // 转换为秒
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
