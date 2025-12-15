"use server";

import db from "@/lib/db";
import { shot } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { createJob } from "@/lib/actions/job";
import { requireAuth } from "@/lib/actions/utils/auth";
import type { ShotDecompositionInput } from "@/types/job";

/**
 * 创建分镜拆解任务
 * 将一个复杂的分镜拆解为多个独立的小分镜
 */
export async function createShotDecompositionJob(params: {
  shotId: string;
  episodeId: string;
}): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    // 1. 验证用户登录
    const { userId } = await requireAuth();

    // 2. 验证分镜是否存在
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, params.shotId),
      with: {
        episode: {
          with: {
            project: true,
          },
        },
        dialogues: true,
      },
    });

    if (!shotData) {
      return {
        success: false,
        error: "分镜不存在",
      };
    }

    // 3. 验证分镜属于指定剧集
    if (shotData.episodeId !== params.episodeId) {
      return {
        success: false,
        error: "分镜不属于指定剧集",
      };
    }

    // 4. 验证项目权限
    const projectId = shotData.episode.projectId;
    const project = shotData.episode.project;

    if (!project) {
      return {
        success: false,
        error: "项目不存在",
      };
    }

    if (project.userId !== userId) {
      return {
        success: false,
        error: "无权访问该项目",
      };
    }

    // 5. 验证分镜是否需要拆解（至少有2个对话或时长超过8秒）
    const dialogueCount = shotData.dialogues?.length || 0;
    const duration = shotData.duration || 0;

    if (dialogueCount < 2 && duration < 8000) {
      return {
        success: false,
        error: "该分镜无需拆解（对话少于2句且时长少于8秒）",
      };
    }

    // 6. 创建拆解任务
    const inputData: ShotDecompositionInput = {
      shotId: params.shotId,
      episodeId: params.episodeId,
    };

    const result = await createJob({
      userId,
      projectId,
      type: "shot_decomposition",
      inputData,
      totalSteps: 4, // 读取信息 -> AI分析 -> 解析结果 -> 完成
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
    console.error("创建分镜拆解任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建任务失败",
    };
  }
}

