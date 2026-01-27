"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { cut as cutTable, project } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { createJob } from "@/lib/actions/job/create";
import type { FinalVideoExportInput } from "@/types/job";

export interface ExportOptions {
  projectId: string;
  quality: "draft" | "high";
  includeAudio: boolean;
}

/**
 * 导出剪辑为视频
 */
export async function exportCut(
  cutId: string,
  options: ExportOptions
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    // 验证用户身份
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: "请先登录" };
    }

    const userId = session.user.id;

    // 验证项目所有权
    const projectData = await db.query.project.findFirst({
      where: and(
        eq(project.id, options.projectId),
        eq(project.userId, userId)
      ),
    });

    if (!projectData) {
      return { success: false, error: "项目不存在或无权访问" };
    }

    // 获取剪辑数据
    const cutData = await db.query.cut.findFirst({
      where: and(
        eq(cutTable.id, cutId),
        eq(cutTable.projectId, options.projectId)
      ),
      with: {
        clips: {
          with: {
            asset: true,
          },
        },
      },
    });

    if (!cutData) {
      return { success: false, error: "剪辑不存在" };
    }

    if (cutData.clips.length === 0) {
      return { success: false, error: "剪辑为空，无法导出" };
    }

    // 提取视频片段 ID 列表（按顺序）
    const videoIds = cutData.clips
      .filter((clip) => clip.trackIndex < 100) // 只取视频轨道片段
      .sort((a, b) => a.startTime - b.startTime)
      .map((clip) => clip.assetId);

    // 构建导出输入数据
    const inputData: FinalVideoExportInput = {
      projectId: options.projectId,
      timelineId: cutId, // 保持字段名向后兼容
      videoIds,
      includeAudio: options.includeAudio,
      exportQuality: options.quality,
      resolution: cutData.resolution ?? undefined,
      fps: cutData.fps ?? undefined,
    };

    // 创建导出任务
    const result = await createJob({
      userId,
      projectId: options.projectId,
      type: "final_video_export",
      inputData,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, jobId: result.jobId };
  } catch (error) {
    console.error("创建导出任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建导出任务失败",
    };
  }
}
