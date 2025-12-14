"use server";

import db from "@/lib/db";
import { episode } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { createJob } from "@/lib/actions/job";
import type { JobType } from "@/types/job";
import { requireAuth, requireEpisodeAccess } from "./auth";

/**
 * 验证剧集是否有剧本内容
 * @throws {Error} 如果剧集没有剧本内容
 */
export async function validateEpisodeHasScript(episodeId: string) {
  const episodeData = await db.query.episode.findFirst({
    where: eq(episode.id, episodeId),
  });

  if (!episodeData) {
    throw new Error("剧集不存在");
  }

  if (!episodeData.scriptContent || !episodeData.scriptContent.trim()) {
    throw new Error("剧集没有剧本内容，请先编写剧本");
  }

  return episodeData;
}

/**
 * 验证项目中的剧集是否有剧本内容
 * @returns 有剧本内容的剧集ID数组
 * @throws {Error} 如果没有任何剧集有剧本内容
 */
export async function validateProjectHasScripts(projectId: string) {
  const episodes = await db.query.episode.findMany({
    where: eq(episode.projectId, projectId),
    orderBy: (episodes, { asc }) => [asc(episodes.order)],
  });

  if (!episodes || episodes.length === 0) {
    throw new Error("项目中没有剧集内容");
  }

  const episodesWithScript = episodes.filter(
    (ep) => ep.scriptContent && ep.scriptContent.trim()
  );

  if (episodesWithScript.length === 0) {
    throw new Error("剧集中没有剧本内容");
  }

  return episodesWithScript.map((ep) => ep.id);
}

/**
 * 通用的基于剧集的提取任务创建函数
 * 适用于角色提取、场景提取等需要分析剧本内容的任务
 */
export async function createExtractionTaskForProject(params: {
  projectId: string;
  jobType: JobType;
  errorMessages?: {
    noEpisodes?: string;
    noScripts?: string;
  };
}): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    // 1. 验证用户登录和项目权限
    const { userId } = await requireAuth();

    // 2. 验证项目中的剧集和剧本
    const episodeIds = await validateProjectHasScripts(params.projectId);

    // 3. 创建任务
    const result = await createJob({
      userId,
      projectId: params.projectId,
      type: params.jobType,
      inputData: { episodeIds },
    });

    if (!result.success || !result.jobId) {
      return { 
        success: false, 
        error: result.error || "创建任务失败" 
      };
    }

    return {
      success: true,
      jobId: result.jobId,
    };
  } catch (error) {
    console.error(`启动 ${params.jobType} 任务失败:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "启动任务失败",
    };
  }
}

/**
 * 通用的基于单个剧集的任务创建函数
 * 适用于分镜生成等针对单个剧集的任务
 */
export async function createTaskForEpisode(params: {
  episodeId: string;
  jobType: JobType;
  validateScript?: boolean;
  additionalInputData?: Record<string, unknown>;
}): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    // 1. 验证用户登录
    const { userId } = await requireAuth();

    // 2. 验证剧集权限
    const episodeData = await requireEpisodeAccess(params.episodeId, userId);

    // 3. 如果需要验证剧本内容
    if (params.validateScript) {
      await validateEpisodeHasScript(params.episodeId);
    }

    // 4. 创建任务
    const inputData = {
      episodeId: params.episodeId,
      ...params.additionalInputData,
    };

    const result = await createJob({
      userId,
      projectId: episodeData.project.projectId || episodeData.projectId,
      type: params.jobType,
      inputData,
    });

    if (!result.success || !result.jobId) {
      return { 
        success: false, 
        error: result.error || "创建任务失败" 
      };
    }

    return {
      success: true,
      jobId: result.jobId,
    };
  } catch (error) {
    console.error(`启动 ${params.jobType} 任务失败:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "启动任务失败",
    };
  }
}

/**
 * 通用的图片生成任务创建函数
 * 适用于角色图片生成、场景图片生成等
 */
export async function createImageGenerationTask(params: {
  projectId: string;
  jobType: JobType;
  inputData: Record<string, unknown>;
  totalSteps?: number;
}): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    // 1. 验证用户登录和项目权限
    const { userId } = await requireAuth();

    // 2. 创建图片生成任务
    const result = await createJob({
      userId,
      projectId: params.projectId,
      type: params.jobType,
      inputData: params.inputData,
      totalSteps: params.totalSteps,
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
    console.error(`创建 ${params.jobType} 任务失败:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建任务失败",
    };
  }
}

