"use server";

import db from "@/lib/db";
import { shotVideo, shot } from "@/lib/db/schemas/project";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { randomUUID } from "crypto";
import type { NewShotVideo, ShotVideo } from "@/types/project";
import type { KlingO1ReferenceToVideoInput } from "@/lib/services/fal.service";
import { createJob } from "@/lib/actions/job";
import type { ShotVideoGenerationInput } from "@/types/job";

/**
 * 创建分镜视频生成任务
 * 
 * 流程：
 * 1. 创建 shot_video 记录（存储 Kling O1 配置）
 * 2. 创建 job 任务（触发 worker 处理）
 * 
 * 注意：Agent 需要直接提供完整的 Kling O1 配置，包括：
 * - prompt: 运动描述
 * - elements: 角色元素（可选）
 * - image_urls: 全局参考图（可选）
 * - start_frame: 起始帧（可选）
 * - duration, aspect_ratio 等
 */
export async function createShotVideoGeneration(data: {
  shotId: string;
  klingO1Config: KlingO1ReferenceToVideoInput;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证 shot 存在
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, data.shotId),
      with: {
        episode: {
          with: {
            project: true,
          },
        },
      },
    });

    if (!shotData) {
      throw new Error("分镜不存在");
    }

    // 创建 shot_video 记录（存储 Kling O1 配置）
    const newShotVideo: NewShotVideo = {
      id: randomUUID(),
      shotId: data.shotId,
      generationConfig: JSON.stringify(data.klingO1Config),
      status: "pending",
      videoUrl: null,
      errorMessage: null,
    };

    const [created] = await db.insert(shotVideo).values(newShotVideo).returning();

    // 创建 job 任务
    const jobInput: ShotVideoGenerationInput = {
      shotId: data.shotId,
      videoConfigId: created.id,
    };

    const jobResult = await createJob({
      userId: session.user.id,
      projectId: shotData.episode.project.id,
      type: "shot_video_generation",
      inputData: jobInput,
    });

    if (!jobResult.success) {
      // 如果创建 job 失败，删除 shot_video 记录
      await db.delete(shotVideo).where(eq(shotVideo.id, created.id));
      throw new Error(jobResult.error || "创建任务失败");
    }

    return {
      success: true,
      data: {
        shotVideo: created,
        jobId: jobResult.data?.id,
      },
    };
  } catch (error) {
    console.error("创建视频生成任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建失败",
    };
  }
}

/**
 * 获取分镜的视频生成历史
 */
export async function getShotVideoHistory(shotId: string): Promise<ShotVideo[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const videos = await db.query.shotVideo.findMany({
      where: eq(shotVideo.shotId, shotId),
      orderBy: [desc(shotVideo.createdAt)],
    });

    return videos;
  } catch (error) {
    console.error("查询视频历史失败:", error);
    return [];
  }
}

/**
 * 设置当前使用的视频版本
 */
export async function setCurrentShotVideo(data: {
  shotId: string;
  videoId: string | null;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证 shot 存在
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, data.shotId),
    });

    if (!shotData) {
      throw new Error("分镜不存在");
    }

    // 如果指定了 videoId，验证它存在
    if (data.videoId) {
      const videoData = await db.query.shotVideo.findFirst({
        where: eq(shotVideo.id, data.videoId),
      });

      if (!videoData) {
        throw new Error("视频版本不存在");
      }

      if (videoData.shotId !== data.shotId) {
        throw new Error("视频版本不属于此分镜");
      }
    }

    // 更新 shot 的 currentVideoId
    const [updated] = await db
      .update(shot)
      .set({ currentVideoId: data.videoId })
      .where(eq(shot.id, data.shotId))
      .returning();

    return { success: true, data: updated };
  } catch (error) {
    console.error("设置当前视频版本失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "设置失败",
    };
  }
}

/**
 * 获取分镜的当前视频版本详情
 */
export async function getCurrentShotVideo(shotId: string): Promise<ShotVideo | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, shotId),
      with: {
        currentVideo: true,
      },
    });

    return shotData?.currentVideo || null;
  } catch (error) {
    console.error("查询当前视频版本失败:", error);
    return null;
  }
}

/**
 * 删除视频版本
 * 注意：如果是当前使用的版本，需要先取消设置
 */
export async function deleteShotVideo(videoId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 查询视频记录
    const videoData = await db.query.shotVideo.findFirst({
      where: eq(shotVideo.id, videoId),
    });

    if (!videoData) {
      throw new Error("视频版本不存在");
    }

    // 检查是否是当前使用的版本
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, videoData.shotId),
    });

    if (shotData?.currentVideoId === videoId) {
      // 先取消设置
      await db
        .update(shot)
        .set({ currentVideoId: null })
        .where(eq(shot.id, videoData.shotId));
    }

    // 删除记录
    await db.delete(shotVideo).where(eq(shotVideo.id, videoId));

    return { success: true };
  } catch (error) {
    console.error("删除视频版本失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    };
  }
}

/**
 * 重试失败的视频生成
 */
export async function retryShotVideoGeneration(videoId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 查询视频记录
    const videoData = await db.query.shotVideo.findFirst({
      where: eq(shotVideo.id, videoId),
    });

    if (!videoData) {
      throw new Error("视频版本不存在");
    }

    if (videoData.status !== "failed") {
      throw new Error("只能重试失败的任务");
    }

    // 查询 shot
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, videoData.shotId),
      with: {
        episode: {
          with: {
            project: true,
          },
        },
      },
    });

    if (!shotData) {
      throw new Error("分镜不存在");
    }

    // 重置状态
    await db
      .update(shotVideo)
      .set({
        status: "pending",
        errorMessage: null,
      })
      .where(eq(shotVideo.id, videoId));

    // 创建新的 job 任务
    const jobInput: ShotVideoGenerationInput = {
      shotId: videoData.shotId,
      videoConfigId: videoId,
    };

    const jobResult = await createJob({
      userId: session.user.id,
      projectId: shotData.episode.project.id,
      type: "shot_video_generation",
      inputData: jobInput,
    });

    if (!jobResult.success) {
      throw new Error(jobResult.error || "创建任务失败");
    }

    return {
      success: true,
      data: {
        jobId: jobResult.data?.id,
      },
    };
  } catch (error) {
    console.error("重试视频生成失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "重试失败",
    };
  }
}

