"use server";

import db from "@/lib/db";
import { shot } from "@/lib/db/schemas/project";
import { inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export type ExportableShotData = {
  id: string;
  order: number;
  videoUrl: string;
};

export type GetExportableShotsResult = {
  success: boolean;
  shots?: ExportableShotData[];
  totalSelected: number;
  totalExportable: number;
  skippedCount: number;
  error?: string;
};

/**
 * 获取可导出的分镜数据
 * 只返回有视频的分镜，自动跳过没有视频的分镜
 */
export async function getExportableShots(
  shotIds: string[]
): Promise<GetExportableShotsResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return {
      success: false,
      error: "未登录",
      totalSelected: shotIds.length,
      totalExportable: 0,
      skippedCount: 0,
    };
  }

  if (!shotIds || shotIds.length === 0) {
    return {
      success: false,
      error: "未选择分镜",
      totalSelected: 0,
      totalExportable: 0,
      skippedCount: 0,
    };
  }

  try {
    // 查询所有选中的分镜
    const allShots = await db.query.shot.findMany({
      where: inArray(shot.id, shotIds),
      with: {
        episode: {
          with: {
            project: true,
          },
        },
        currentVideo: true,
      },
    });

    if (allShots.length === 0) {
      return {
        success: false,
        error: "未找到分镜",
        totalSelected: shotIds.length,
        totalExportable: 0,
        skippedCount: 0,
      };
    }

    // 验证用户权限（检查第一个分镜所属项目）
    const firstShot = allShots[0];
    const episodeData = Array.isArray(firstShot.episode)
      ? firstShot.episode[0]
      : firstShot.episode;
    
    if (!episodeData) {
      return {
        success: false,
        error: "无法获取剧集信息",
        totalSelected: shotIds.length,
        totalExportable: 0,
        skippedCount: 0,
      };
    }

    const projectData = Array.isArray(episodeData.project)
      ? episodeData.project[0]
      : episodeData.project;

    if (!projectData) {
      return {
        success: false,
        error: "无法获取项目信息",
        totalSelected: shotIds.length,
        totalExportable: 0,
        skippedCount: 0,
      };
    }

    // 验证项目所有权
    if (projectData.userId !== session.user.id) {
      return {
        success: false,
        error: "无权访问该项目",
        totalSelected: shotIds.length,
        totalExportable: 0,
        skippedCount: 0,
      };
    }

    // 筛选出有视频的分镜
    const exportableShots = allShots
      .filter((s) => {
        const currentVideo = Array.isArray(s.currentVideo) 
          ? s.currentVideo[0] 
          : s.currentVideo;
        return currentVideo?.videoUrl;
      })
      .map((s) => {
        const currentVideo = Array.isArray(s.currentVideo)
          ? s.currentVideo[0]
          : s.currentVideo;
        return {
          id: s.id,
          order: s.order,
          videoUrl: currentVideo!.videoUrl as string,
        };
      })
      .sort((a, b) => a.order - b.order); // 按照 order 排序

    const skippedCount = allShots.length - exportableShots.length;

    // 如果没有可导出的分镜
    if (exportableShots.length === 0) {
      return {
        success: false,
        error: "没有可导出的视频，请先生成视频",
        totalSelected: shotIds.length,
        totalExportable: 0,
        skippedCount,
      };
    }

    return {
      success: true,
      shots: exportableShots,
      totalSelected: shotIds.length,
      totalExportable: exportableShots.length,
      skippedCount,
    };
  } catch (error) {
    console.error("获取可导出分镜失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取失败",
      totalSelected: shotIds.length,
      totalExportable: 0,
      skippedCount: 0,
    };
  }
}
