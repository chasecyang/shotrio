"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { video, project } from "@/lib/db/schemas/project";
import { eq, desc, asc } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Video, NewVideo, VideoDetail } from "@/types/project";
import type { KlingO1ReferenceToVideoInput } from "@/lib/services/fal.service";
import { createJob } from "@/lib/actions/job";
import type { VideoGenerationInput } from "@/types/job";

/**
 * 获取项目的所有视频（按创建时间或order排序）
 */
export async function getProjectVideos(
  projectId: string,
  orderBy: "created" | "order" = "created"
): Promise<Video[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const orderByClause = orderBy === "order" 
      ? [asc(video.order), desc(video.createdAt)]
      : [desc(video.createdAt)];

    const videos = await db.query.video.findMany({
      where: eq(video.projectId, projectId),
      orderBy: orderByClause,
    });

    return videos as Video[];
  } catch (error) {
    console.error("获取视频列表失败:", error);
    return [];
  }
}

/**
 * 获取单个视频详情
 */
export async function getVideoById(videoId: string): Promise<VideoDetail | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const videoData = await db.query.video.findFirst({
      where: eq(video.id, videoId),
    });

    if (!videoData) {
      return null;
    }

    // 如果有参考素材，加载素材信息
    let referenceAssets = undefined;
    if (videoData.referenceAssetIds && videoData.referenceAssetIds.length > 0) {
      const { asset } = await import("@/lib/db/schemas/project");
      const { inArray } = await import("drizzle-orm");
      
      referenceAssets = await db.query.asset.findMany({
        where: inArray(asset.id, videoData.referenceAssetIds),
      });
    }

    return {
      ...videoData,
      referenceAssets,
    } as VideoDetail;
  } catch (error) {
    console.error("获取视频详情失败:", error);
    return null;
  }
}

/**
 * 创建视频生成任务
 * 
 * 流程：
 * 1. 创建 video 记录（存储 prompt 和配置）
 * 2. 创建 job 任务（触发 worker 处理）
 */
export async function createVideoGeneration(data: {
  projectId: string;
  prompt: string;
  title?: string;
  referenceAssetIds?: string[];
  klingO1Config: KlingO1ReferenceToVideoInput;
  order?: number;
  tags?: string[];
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证项目存在
    const projectData = await db.query.project.findFirst({
      where: eq(project.id, data.projectId),
    });

    if (!projectData) {
      throw new Error("项目不存在");
    }

    // 验证项目所有权
    if (projectData.userId !== session.user.id) {
      throw new Error("无权限操作此项目");
    }

    // 创建 video 记录
    const newVideo: NewVideo = {
      id: randomUUID(),
      projectId: data.projectId,
      userId: session.user.id,
      prompt: data.prompt,
      title: data.title || null,
      referenceAssetIds: data.referenceAssetIds || null,
      generationConfig: JSON.stringify(data.klingO1Config),
      status: "pending",
      videoUrl: null,
      thumbnailUrl: null,
      duration: null,
      errorMessage: null,
      order: data.order || null,
      tags: data.tags || null,
    };

    const [created] = await db.insert(video).values(newVideo).returning();

    // 创建 job 任务
    const jobInput: VideoGenerationInput = {
      videoId: created.id,
    };

    const jobResult = await createJob({
      userId: session.user.id,
      projectId: data.projectId,
      type: "video_generation",
      inputData: jobInput,
    });

    if (!jobResult.success) {
      // 如果创建 job 失败，删除 video 记录
      await db.delete(video).where(eq(video.id, created.id));
      throw new Error(jobResult.error || "创建任务失败");
    }

    return {
      success: true,
      data: {
        video: created,
        jobId: jobResult.jobId,
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
 * 更新视频信息（prompt、title、order、tags等）
 */
export async function updateVideo(
  videoId: string,
  data: Partial<Pick<Video, "prompt" | "title" | "order" | "tags">>
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证视频存在且有权限
    const videoData = await db.query.video.findFirst({
      where: eq(video.id, videoId),
    });

    if (!videoData) {
      throw new Error("视频不存在");
    }

    if (videoData.userId !== session.user.id) {
      throw new Error("无权限操作此视频");
    }

    const [updated] = await db
      .update(video)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(video.id, videoId))
      .returning();

    return { success: true, data: updated };
  } catch (error) {
    console.error("更新视频失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新失败",
    };
  }
}

/**
 * 删除视频
 */
export async function deleteVideo(videoId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证视频存在且有权限
    const videoData = await db.query.video.findFirst({
      where: eq(video.id, videoId),
    });

    if (!videoData) {
      throw new Error("视频不存在");
    }

    if (videoData.userId !== session.user.id) {
      throw new Error("无权限操作此视频");
    }

    await db.delete(video).where(eq(video.id, videoId));

    return { success: true };
  } catch (error) {
    console.error("删除视频失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    };
  }
}

/**
 * 批量删除视频
 */
export async function deleteVideos(videoIds: string[]) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const { inArray } = await import("drizzle-orm");
    
    // 验证所有视频的权限
    const videos = await db.query.video.findMany({
      where: inArray(video.id, videoIds),
    });

    const unauthorizedVideos = videos.filter(v => v.userId !== session.user.id);
    if (unauthorizedVideos.length > 0) {
      throw new Error("部分视频无权限删除");
    }

    await db.delete(video).where(inArray(video.id, videoIds));

    return { success: true, deletedCount: videoIds.length };
  } catch (error) {
    console.error("批量删除视频失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    };
  }
}

/**
 * 基于现有视频生成新视频（remix/变体）
 */
export async function remixVideo(data: {
  sourceVideoId: string;
  newPrompt: string;
  title?: string;
  klingO1Config: KlingO1ReferenceToVideoInput;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 获取源视频
    const sourceVideo = await db.query.video.findFirst({
      where: eq(video.id, data.sourceVideoId),
    });

    if (!sourceVideo) {
      throw new Error("源视频不存在");
    }

    if (sourceVideo.userId !== session.user.id) {
      throw new Error("无权限操作此视频");
    }

    // 创建新视频，继承部分配置
    return createVideoGeneration({
      projectId: sourceVideo.projectId,
      prompt: data.newPrompt,
      title: data.title,
      referenceAssetIds: sourceVideo.referenceAssetIds || undefined,
      klingO1Config: data.klingO1Config,
      tags: sourceVideo.tags || undefined,
    });
  } catch (error) {
    console.error("Remix视频失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Remix失败",
    };
  }
}

