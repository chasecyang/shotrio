"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { episode, asset } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { createJob, createChildJob } from "./job/create";
import { createAssetInternal } from "./asset/crud";
import type {
  ScriptElementExtractionInput,
  AssetImageGenerationInput,
} from "@/types/job";

/**
 * 启动剧本元素提取任务
 */
export async function startScriptExtraction(episodeId: string): Promise<{
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
    // 验证剧集存在且有权限
    const episodeData = await db.query.episode.findFirst({
      where: eq(episode.id, episodeId),
      with: {
        project: true,
      },
    });

    if (!episodeData) {
      return { success: false, error: "剧集不存在" };
    }

    if (episodeData.project.userId !== session.user.id) {
      return { success: false, error: "无权限访问此剧集" };
    }

    // 验证剧本内容
    if (!episodeData.scriptContent || !episodeData.scriptContent.trim()) {
      return { success: false, error: "剧本内容为空，无法提取元素" };
    }

    // 创建提取任务
    const inputData: ScriptElementExtractionInput = {
      episodeId,
      scriptContent: episodeData.scriptContent,
    };

    const result = await createJob({
      userId: session.user.id,
      projectId: episodeData.projectId,
      type: "script_element_extraction",
      inputData,
      totalSteps: 1,
    });

    return result;
  } catch (error) {
    console.error("启动剧本提取任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "启动任务失败",
    };
  }
}

/**
 * 批量创建素材（从提取结果）
 */
export async function batchCreateAssetsFromExtraction(input: {
  projectId: string;
  episodeId: string;
  elements: Array<{
    id: string;
    type: "character" | "scene" | "prop" | "costume" | "effect";
    name: string;
    description: string;
    prompt: string;
    tags: string[];
    shouldGenerate: boolean;
  }>;
}): Promise<{
  success: boolean;
  createdCount?: number;
  generateJobIds?: string[];
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证项目权限
    const episodeData = await db.query.episode.findFirst({
      where: eq(episode.id, input.episodeId),
      with: {
        project: true,
      },
    });

    if (!episodeData) {
      return { success: false, error: "剧集不存在" };
    }

    if (episodeData.project.userId !== session.user.id) {
      return { success: false, error: "无权限" };
    }

    const createdAssetIds: string[] = [];
    const generateJobIds: string[] = [];

    // 批量创建所有素材（无论是否生成图片）
    for (const element of input.elements) {
      // 创建Asset记录（prompt only，imageUrl为空字符串）
      const assetResult = await createAssetInternal({
        userId: session.user.id,
        projectId: input.projectId,
        name: element.name,
        imageUrl: "", // 空字符串表示待生成
        prompt: element.prompt,
        tags: element.tags,
        meta: {
          custom: {
            description: element.description,
            elementType: element.type,
            fromScriptExtraction: true,
            episodeId: input.episodeId,
          },
        },
      });

      if (assetResult.success && assetResult.asset) {
        createdAssetIds.push(assetResult.asset.id);

        // 如果需要生成图片，创建生成任务
        if (element.shouldGenerate) {
          const generateInput: AssetImageGenerationInput = {
            projectId: input.projectId,
            prompt: element.prompt,
            assetType: 
              element.type === "character" ? "character" :
              element.type === "scene" ? "scene" :
              element.type === "prop" ? "prop" :
              "reference",
            mode: "text-to-image",
            numImages: 1,
          };

          const jobResult = await createChildJob({
            userId: session.user.id,
            projectId: input.projectId,
            type: "asset_image_generation",
            inputData: generateInput,
          });

          if (jobResult.success && jobResult.jobId) {
            generateJobIds.push(jobResult.jobId);
          }
        }
      }
    }

    return {
      success: true,
      createdCount: createdAssetIds.length,
      generateJobIds: generateJobIds.length > 0 ? generateJobIds : undefined,
    };
  } catch (error) {
    console.error("批量创建素材失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "批量创建素材失败",
    };
  }
}

