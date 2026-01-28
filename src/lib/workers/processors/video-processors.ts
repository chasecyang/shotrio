"use server";

import { randomUUID } from "crypto";
import db from "@/lib/db";
import { asset, videoData } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { generateVideo } from "@/lib/services/video-service";
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
import { checkImageDependencies, extractDependenciesFromSnapshot } from "../utils/dependency-checker";
import { DependencyNotReadyError } from "../errors/DependencyNotReadyError";

// Veo 3.1 固定使用的模型名称
const VIDEO_MODEL_USED = "veo3_fast";

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
        videoDataList: true,
      },
    });

    if (!assetData) {
      throw new Error("视频资产不存在");
    }

    // 优先使用 job 指定的版本（用于重新生成），其次使用激活版本
    let targetVideoData = jobData.videoDataId
      ? assetData.videoDataList?.find((v: any) => v.id === jobData.videoDataId)
      : null;

    if (!targetVideoData) {
      targetVideoData = assetData.videoDataList?.find((v: any) => v.isActive) ?? assetData.videoDataList?.[0];
    }

    if (!targetVideoData?.generationConfig) {
      throw new Error("视频生成配置不存在（videoData）");
    }

    // 2. 解析视频生成配置（从 videoData 表读取）
    const config: VideoGenerationConfig = JSON.parse(targetVideoData.generationConfig);
    const type = config.type;

    console.log(`[Worker] 视频生成类型: ${type}`);
    console.log(`[Worker] 配置:`, {
      type,
      prompt: config.prompt,
      aspectRatio: config.aspect_ratio,
    });

    // 2.5 检查依赖是否就绪（在扣除积分之前）
    const versionSnapshot = config._versionSnapshot;
    if (versionSnapshot) {
      const dependencyIds = extractDependenciesFromSnapshot(versionSnapshot);
      if (dependencyIds.length > 0) {
        console.log(`[Worker] 检查依赖: ${dependencyIds.join(", ")}`);
        const dependencyCheck = await checkImageDependencies(dependencyIds);

        if (!dependencyCheck.ready) {
          if (dependencyCheck.failedDependencies && dependencyCheck.failedDependencies.length > 0) {
            // 依赖失败（被删除等），直接抛出错误
            const reasons = dependencyCheck.failedDependencies.map(d => d.reason).join("; ");
            throw new Error(`依赖检查失败: ${reasons}`);
          }

          if (dependencyCheck.waitingFor && dependencyCheck.waitingFor.length > 0) {
            // 依赖未就绪，抛出特殊错误以触发重新排队
            console.log(`[Worker] 依赖未就绪，等待: ${dependencyCheck.waitingFor.map(d => d.imageDataId).join(", ")}`);
            throw new DependencyNotReadyError(
              "依赖的图片还在生成中",
              dependencyCheck.waitingFor
            );
          }
        }
        console.log(`[Worker] 所有依赖已就绪`);
      }
    }

    // 3. 将 Asset ID 转换为真实的图片 URL（支持版本快照）
    const resolveImageUrl = async (
      assetIdOrUrl: string,
      versionId?: string // 可选：版本快照中的 imageData.id
    ): Promise<string | null> => {
      // 如果已经是 HTTP URL，直接返回
      if (assetIdOrUrl.startsWith("http")) {
        return assetIdOrUrl;
      }
      // 否则当作 Asset ID 处理，从数据库查询真实 URL
      const imageAsset = await db.query.asset.findFirst({
        where: eq(asset.id, assetIdOrUrl),
        with: {
          imageDataList: true,
        },
      });

      // 优先使用版本快照中指定的版本
      if (versionId) {
        const targetVersion = imageAsset?.imageDataList?.find(
          (img: { id: string; imageUrl: string | null }) => img.id === versionId
        );
        if (targetVersion?.imageUrl) {
          console.log(`[Worker] 使用版本快照: ${versionId}`);
          return targetVersion.imageUrl;
        }
        // 版本不存在或已删除，记录警告并回退到激活版本
        console.warn(
          `[Worker] 版本 ${versionId} 不存在或已删除，回退到激活版本`
        );
      }

      // 回退：使用激活版本（向后兼容）
      const activeImageData = imageAsset?.imageDataList?.find(
        (img: { isActive: boolean }) => img.isActive
      );
      if (!activeImageData?.imageUrl) {
        // 返回 null 而不是抛出错误，让调用方处理
        return null;
      }
      return activeImageData.imageUrl;
    };

    // 解析参考图的真实 URL（Veo 3.1 模式）
    const versionIds = versionSnapshot?.reference_image_version_ids || [];

    if (config.reference_image_urls && config.reference_image_urls.length > 0) {
      // 解析 reference_image_urls
      const resolvedUrls: string[] = [];

      for (let i = 0; i < config.reference_image_urls.length; i++) {
        const imageIdOrUrl = config.reference_image_urls[i];
        const versionId = versionIds[i];

        const resolvedUrl = await resolveImageUrl(imageIdOrUrl, versionId);
        if (!resolvedUrl) {
          throw new Error(`无法找到参考图 ${i + 1} 的 URL: ${imageIdOrUrl}`);
        }
        resolvedUrls.push(resolvedUrl);
        console.log(`[Worker] 参考图 ${i + 1} URL: ${resolvedUrl}`);
      }

      config.reference_image_urls = resolvedUrls;
    }

    // 注意：不需要手动更新asset状态为processing
    // 状态从关联的job动态计算，job已经在startJob时被设置为processing

    // 3. 计算积分消费（根据配置的时长）
    const videoDuration = config.duration ?? 4;
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
      description: `descriptions.generation.video`,
      metadata: {
        jobId: jobData.id,
        assetId,
        projectId: jobData.projectId,
        duration: videoDuration,
        type,
        costPerSecond: CREDIT_COSTS.VIDEO_GENERATION_PER_SECOND,
        translationParams: { duration: videoDuration, type },
      },
    });

    if (!spendResult.success) {
      throw new Error(spendResult.error || "积分不足");
    }

    const transactionId = spendResult.transactionId;

    // Veo 3.1 视频服务
    const providerName = "Veo 3.1";

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 25,
        progressMessage: `调用 ${providerName} API 生成视频（${type}, ${videoDuration}s）...`,
      },
      workerToken
    );

    // 5. 调用统一的视频生成服务
    console.log(`[Worker] 使用 Veo 3.1 服务生成视频 (${type}, ${videoDuration}s)`);
    console.log(`[Worker] 完整配置:`, JSON.stringify(config, null, 2));

    let videoResult;
    try {
      // 使用统一的视频服务接口
      videoResult = await generateVideo(config);
    } catch (error) {
      // 打印详细错误信息
      console.error(`[Worker] Veo 3.1 API 调用失败 (${type}):`, error);
      if (error && typeof error === 'object' && 'body' in error) {
        console.error(`[Worker] 错误详情:`, JSON.stringify((error as any).body, null, 2));
      }

      // 生成失败，退还积分
      if (transactionId) {
        await refundCredits({
          userId: jobData.userId,
          amount: creditsNeeded,
          description: `descriptions.refund.video_generation_failed`,
          metadata: {
            jobId: jobData.id,
            assetId,
            originalTransactionId: transactionId,
            reason: "generation_failed",
            type,
            provider: "veo",
            translationParams: { type },
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

    console.log(`[Worker] Veo 3.1 API (${type}) 返回视频URL: ${videoResult.videoUrl}`);

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
          description: `descriptions.refund.video_upload_failed`,
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

    // 获取视频真实时长
    let actualDuration = videoDuration * 1000;
    try {
      const { getVideoDuration } = await import("@/lib/utils/video-thumbnail");
      const realDuration = await getVideoDuration(uploadResult.url);
      if (realDuration) {
        actualDuration = realDuration;
        console.log(`[Worker] 视频真实时长: ${actualDuration}ms`);
      }
    } catch (e) {
      console.warn(`[Worker] 获取视频时长失败，使用配置时长:`, e);
    }

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
    const videoDataId = jobData.videoDataId;

    if (videoDataId) {
      // 新架构：通过 videoDataId 更新具体版本记录
      // 先将所有版本设为非激活
      await db
        .update(videoData)
        .set({ isActive: false })
        .where(eq(videoData.assetId, assetId));

      // 更新当前版本并激活
      await db
        .update(videoData)
        .set({
          videoUrl: uploadResult.url,
          thumbnailUrl: thumbnailUrl || null,
          duration: actualDuration, // 使用真实时长
          modelUsed: VIDEO_MODEL_USED,
          isActive: true,
        })
        .where(eq(videoData.id, videoDataId));
    } else {
      // 迁移兼容：查找现有 videoData 或创建新记录
      const existingVideoData = await db.query.videoData.findFirst({
        where: eq(videoData.assetId, assetId),
      });

      if (existingVideoData) {
        // 更新现有记录
        await db
          .update(videoData)
          .set({
            videoUrl: uploadResult.url,
            thumbnailUrl: thumbnailUrl || null,
            duration: actualDuration,
          })
          .where(eq(videoData.id, existingVideoData.id));
      } else {
        // 创建新记录
        await db.insert(videoData).values({
          id: randomUUID(),
          assetId: assetId,
          videoUrl: uploadResult.url,
          thumbnailUrl: thumbnailUrl || null,
          duration: actualDuration,
          isActive: true,
        });
      }
    }

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
 * 使用 Remotion 渲染时间轴为视频文件
 */
export async function processFinalVideoExport(jobData: Job, workerToken: string): Promise<void> {
  // 严格验证输入数据
  const input = jobData.inputData as FinalVideoExportInput | null;

  if (!input || !input.projectId) {
    throw new Error("Job 格式错误：缺少 projectId");
  }

  const { projectId, timelineId, includeAudio, exportQuality } = input;

  console.log(`[Worker] 开始导出成片: Project ${projectId}, Timeline ${timelineId}`);

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
        progressMessage: "加载时间轴数据...",
      },
      workerToken
    );

    // 查询时间轴数据（包含 clips 和 assets）
    const timeline = await db.query.timeline.findFirst({
      where: (t, { eq }) => eq(t.id, timelineId || ""),
      with: {
        clips: {
          with: {
            asset: {
              with: {
                videoDataList: true,
                audioDataList: true,
              },
            },
          },
        },
      },
    });

    if (!timeline) {
      throw new Error("时间轴不存在");
    }

    if (timeline.clips.length === 0) {
      throw new Error("时间轴为空，无法导出");
    }

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 10,
        progressMessage: `找到 ${timeline.clips.length} 个片段，准备渲染...`,
      },
      workerToken
    );

    // 获取每个片段的 mediaUrl
    const getMediaUrl = (clip: typeof timeline.clips[0]): string | null => {
      const assetObj = clip.asset;
      if (assetObj.assetType === "video") {
        const activeVideo = assetObj.videoDataList?.find((v: { isActive: boolean }) => v.isActive);
        return activeVideo?.videoUrl || null;
      } else if (assetObj.assetType === "audio") {
        const activeAudio = assetObj.audioDataList?.find((a: { isActive: boolean }) => a.isActive);
        return activeAudio?.audioUrl || null;
      }
      return null;
    };

    // 过滤出有效片段（有 mediaUrl）
    const validClips = timeline.clips.filter((clip) => {
      const mediaUrl = getMediaUrl(clip);
      return mediaUrl !== null;
    });

    if (validClips.length === 0) {
      throw new Error("没有可渲染的片段");
    }

    // 解析分辨率
    const [width, height] = (timeline.resolution || "1080x1920").split("x").map(Number);
    const fps = timeline.fps || 30;

    // 构建 Remotion props
    const trackMap = new Map<number, Array<{
      id: string;
      from: number;
      durationInFrames: number;
      src: string;
      startFrom: number;
    }>>();

    for (const clip of validClips) {
      const mediaUrl = getMediaUrl(clip);
      if (!mediaUrl) continue;

      if (!trackMap.has(clip.trackIndex)) {
        trackMap.set(clip.trackIndex, []);
      }

      const msToFrames = (ms: number) => Math.round((ms / 1000) * fps);

      trackMap.get(clip.trackIndex)!.push({
        id: clip.id,
        from: msToFrames(clip.startTime),
        durationInFrames: msToFrames(clip.duration),
        src: mediaUrl,
        startFrom: msToFrames(clip.trimStart),
      });
    }

    // 构建轨道数组
    const tracks: Array<{
      name: string;
      trackIndex: number;
      type: "video" | "audio";
      items: Array<{
        id: string;
        from: number;
        durationInFrames: number;
        src: string;
        startFrom: number;
      }>;
    }> = [];

    trackMap.forEach((items, trackIndex) => {
      const isVideo = trackIndex < 100;
      // 如果不包含音频，跳过音频轨道
      if (!isVideo && !includeAudio) return;

      tracks.push({
        name: `Track ${trackIndex}`,
        trackIndex,
        type: isVideo ? "video" : "audio",
        items: items.sort((a, b) => a.from - b.from),
      });
    });

    const msToFrames = (ms: number) => Math.round((ms / 1000) * fps);
    let durationInFrames = Math.max(1, msToFrames(timeline.duration));

    // 额外保护：如果轨道为空或时长无效，确保至少有 30 帧
    if (tracks.length === 0 || durationInFrames <= 0) {
      durationInFrames = 30;
    }

    // 构建轨道状态（默认所有音频轨道不静音）
    const trackStates: Record<number, { volume: number; isMuted: boolean }> = {};
    tracks.forEach((track) => {
      if (track.type === "audio") {
        trackStates[track.trackIndex] = { volume: 1, isMuted: false };
      }
    });

    const compositionProps = {
      tracks,
      fps,
      width: width || 1080,
      height: height || 1920,
      durationInFrames,
      trackStates,
    };

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 20,
        progressMessage: "准备 Remotion 渲染环境...",
      },
      workerToken
    );

    // 动态导入 Remotion 模块（避免在非 worker 环境加载）
    const { bundle } = await import("@remotion/bundler");
    const { renderMedia, selectComposition } = await import("@remotion/renderer");
    const path = await import("path");
    const os = await import("os");
    const fs = await import("fs/promises");

    // 创建临时目录
    const tempDir = path.join(os.tmpdir(), `remotion-export-${jobData.id}`);
    await fs.mkdir(tempDir, { recursive: true });

    const outputPath = path.join(tempDir, "output.mp4");

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 30,
        progressMessage: "打包 Remotion 项目...",
      },
      workerToken
    );

    // 打包 Remotion 项目
    const entryPoint = path.join(process.cwd(), "src", "lib", "remotion", "index.ts");

    let bundleLocation: string;
    try {
      bundleLocation = await bundle({
        entryPoint,
        onProgress: (progress) => {
          // 打包进度：30-50%
          const bundleProgress = 30 + Math.round(progress * 20);
          updateJobProgress(
            {
              jobId: jobData.id,
              progress: bundleProgress,
              progressMessage: `打包进度: ${Math.round(progress * 100)}%`,
            },
            workerToken
          ).catch(console.error);
        },
      });
    } catch (bundleError) {
      console.error("[Worker] Remotion 打包失败:", bundleError);
      throw new Error(`Remotion 打包失败: ${bundleError instanceof Error ? bundleError.message : "未知错误"}`);
    }

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 50,
        progressMessage: "开始渲染视频...",
      },
      workerToken
    );

    // 选择 composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: "TimelineComposition",
      inputProps: compositionProps,
    });

    // 渲染视频
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: compositionProps,
      // 根据质量设置选择不同的渲染参数
      ...(exportQuality === "draft"
        ? {
            jpegQuality: 70,
            scale: 0.5, // 草稿模式降低分辨率
          }
        : {
            jpegQuality: 95,
          }),
      onProgress: ({ progress }) => {
        // 渲染进度：50-85%
        const renderProgress = 50 + Math.round(progress * 35);
        updateJobProgress(
          {
            jobId: jobData.id,
            progress: renderProgress,
            progressMessage: `渲染进度: ${Math.round(progress * 100)}%`,
          },
          workerToken
        ).catch(console.error);
      },
    });

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 85,
        progressMessage: "上传视频到存储...",
      },
      workerToken
    );

    // 读取渲染后的视频文件
    const videoBuffer = await fs.readFile(outputPath);
    const fileSize = videoBuffer.length;

    // 上传到 R2
    const fileName = `export-${projectId}-${Date.now()}.mp4`;
    const uploadResult = await uploadVideoFromUrl(
      `data:video/mp4;base64,${videoBuffer.toString("base64")}`,
      fileName,
      jobData.userId
    );

    // 清理临时文件
    await fs.rm(tempDir, { recursive: true, force: true }).catch(console.error);

    if (!uploadResult.success || !uploadResult.url) {
      throw new Error(`上传视频失败: ${uploadResult.error || "未知错误"}`);
    }

    await updateJobProgress(
      {
        jobId: jobData.id,
        progress: 95,
        progressMessage: "完成导出...",
      },
      workerToken
    );

    const result: FinalVideoExportResult = {
      projectId,
      videoUrl: uploadResult.url,
      duration: timeline.duration / 1000, // 转换为秒
      fileSize,
    };

    await completeJob(
      {
        jobId: jobData.id,
        resultData: result,
      },
      workerToken
    );

    console.log(`[Worker] 导出完成: Project ${projectId}, URL: ${uploadResult.url}`);
  } catch (error) {
    console.error(`[Worker] 导出失败:`, error);
    throw error;
  }
}
