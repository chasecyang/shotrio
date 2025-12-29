"use server";

import db from "@/lib/db";
import { shot } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { buildVideoPrompt, getKlingDuration } from "@/lib/utils/motion-prompt";
import type { ShotVideoGenerationInput } from "@/types/job";

/**
 * 生成单个分镜的视频
 */
export async function generateShotVideo(shotId: string): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 获取分镜信息以验证权限和数据（需要关联素材）
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, shotId),
      with: {
        episode: true,
        shotAssets: {
          with: {
            asset: true,
          },
          orderBy: (shotAsset, { asc }) => [asc(shotAsset.order)],
        },
      },
    });

    if (!shotData) {
      return { success: false, error: "分镜不存在" };
    }

    // 检查是否有关联的图片（取第一张素材）
    const firstAsset = shotData.shotAssets?.[0]?.asset;
    if (!firstAsset || !firstAsset.imageUrl) {
      return { success: false, error: "该分镜没有图片，请先生成图片" };
    }

    // 自动生成视频参数（包含画面描述）
    const videoPrompt = buildVideoPrompt({
      description: shotData.description || undefined,
      visualPrompt: shotData.visualPrompt || undefined,
      cameraMovement: shotData.cameraMovement,
    });

    const duration = getKlingDuration(shotData.duration || 3000);

    // 创建视频生成任务
    const { createJob } = await import("@/lib/actions/job");
    const episode = shotData.episode && 'projectId' in shotData.episode ? shotData.episode : null;
    const result = await createJob({
      userId: session.user.id,
      projectId: episode?.projectId || "",
      type: "shot_video_generation",
      inputData: {
        shotId,
        imageUrl: firstAsset.imageUrl,
        prompt: videoPrompt,
        duration,
        regenerate: false,
      } as ShotVideoGenerationInput,
    });

    if (!result.success || !result.jobId) {
      return {
        success: false,
        error: result.error || "创建任务失败",
      };
    }

    return {
      success: true,
      jobId: result.jobId,
    };
  } catch (error) {
    console.error("生成分镜视频失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "生成失败",
    };
  }
}

/**
 * 更新分镜视频 URL (手动调用，通常由 worker 自动更新)
 */
export async function updateShotVideo(shotId: string, videoUrl: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证权限
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, shotId),
      with: {
        episode: {
          with: {
            project: true,
          },
        },
      },
    });

    if (!shotData) {
      return { success: false, error: "分镜不存在" };
    }

    const episodeData = shotData.episode as { project?: { userId?: string } } | null;
    if (episodeData?.project?.userId !== session.user.id) {
      return { success: false, error: "无权限操作" };
    }

    // 更新视频URL
    await db
      .update(shot)
      .set({
        videoUrl,
        updatedAt: new Date(),
      })
      .where(eq(shot.id, shotId));

    return { success: true };
  } catch (error) {
    console.error("更新视频URL失败:", error);
    return { success: false, error: "服务器错误" };
  }
}
