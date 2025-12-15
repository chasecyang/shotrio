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
    // 获取分镜信息以验证权限和数据（包含对话）
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, shotId),
      with: {
        episode: true,
        dialogues: {
          orderBy: (shotDialogue, { asc }) => [asc(shotDialogue.order)],
          with: {
            character: true,
          },
        },
      },
    });

    if (!shotData) {
      return { success: false, error: "分镜不存在" };
    }

    // 检查是否有图片
    if (!shotData.imageUrl) {
      return { success: false, error: "该分镜没有图片，请先生成图片" };
    }

    // 自动生成视频参数（包含画面描述和对话）
    const videoPrompt = buildVideoPrompt({
      visualDescription: shotData.visualDescription || undefined,
      visualPrompt: shotData.visualPrompt || undefined,
      cameraMovement: shotData.cameraMovement,
      dialogues: shotData.dialogues?.map(d => ({
        characterName: d.character?.name,
        dialogueText: d.dialogueText,
        emotionTag: d.emotionTag,
      })),
    });

    const duration = getKlingDuration(shotData.duration || 3000);

    // 创建视频生成任务
    const { createJob } = await import("@/lib/actions/job");
    const result = await createJob({
      userId: session.user.id,
      projectId: shotData.episode.projectId,
      type: "shot_video_generation",
      inputData: {
        shotId,
        imageUrl: shotData.imageUrl,
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
 * 批量生成分镜视频
 */
export async function batchGenerateShotVideos(shotIds: string[]): Promise<{
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

  if (!shotIds || shotIds.length === 0) {
    return { success: false, error: "未选择分镜" };
  }

  try {
    // 获取第一个分镜信息以获取项目ID
    const firstShot = await db.query.shot.findFirst({
      where: eq(shot.id, shotIds[0]),
      with: {
        episode: true,
      },
    });

    if (!firstShot) {
      return { success: false, error: "分镜不存在" };
    }

    // 创建批量视频生成任务
    const { createJob } = await import("@/lib/actions/job");
    const result = await createJob({
      userId: session.user.id,
      projectId: firstShot.episode.projectId,
      type: "batch_video_generation",
      inputData: {
        shotIds,
      },
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
    console.error("批量生成视频失败:", error);
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

    if (shotData.episode.project.userId !== session.user.id) {
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
