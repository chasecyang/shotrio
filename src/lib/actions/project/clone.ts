"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import {
  project,
  projectTemplate,
  asset,
  assetTag,
  imageData,
  videoData,
  textData,
  audioData,
} from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Project } from "@/types/project";

/**
 * 复制模板项目到用户账户
 * 用于"从模板创建"功能
 */
export async function cloneTemplateProject(templateProjectId: string): Promise<{
  success: boolean;
  projectId?: string;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 1. 验证源项目是模板
    const templateInfo = await db.query.projectTemplate.findFirst({
      where: eq(projectTemplate.projectId, templateProjectId),
    });

    if (!templateInfo) {
      return { success: false, error: "该项目不是模板项目" };
    }

    // 2. 获取源项目完整数据
    const sourceProject = await db.query.project.findFirst({
      where: eq(project.id, templateProjectId),
      with: {
        assets: {
          with: {
            tags: true,
            imageDataList: true,
            videoDataList: true,
            textData: true,
            audioData: true,
          },
        },
      },
    });

    if (!sourceProject) {
      return { success: false, error: "模板项目不存在" };
    }

    // 3. 创建新项目
    const newProjectId = randomUUID();
    await db.insert(project).values({
      id: newProjectId,
      userId: session.user.id,
      title: sourceProject.title,
      description: sourceProject.description,
      stylePrompt: sourceProject.stylePrompt,
      styleId: sourceProject.styleId,
      status: "draft",
    });

    // 4. 复制资产
    const assetIdMap = new Map<string, string>(); // 旧ID -> 新ID

    for (const sourceAsset of sourceProject.assets) {
      const newAssetId = randomUUID();
      assetIdMap.set(sourceAsset.id, newAssetId);

      // 4.1 复制 asset 基表
      await db.insert(asset).values({
        id: newAssetId,
        projectId: newProjectId,
        userId: session.user.id,
        name: sourceAsset.name,
        assetType: sourceAsset.assetType,
        sourceType: sourceAsset.sourceType,
        meta: sourceAsset.meta,
        order: sourceAsset.order,
        usageCount: 0,
      });

      // 4.2 复制标签
      if (sourceAsset.tags && sourceAsset.tags.length > 0) {
        await db.insert(assetTag).values(
          sourceAsset.tags.map((tag: { tagValue: string }) => ({
            id: randomUUID(),
            assetId: newAssetId,
            tagValue: tag.tagValue,
          }))
        );
      }

      // 4.3 复制类型特定数据
      switch (sourceAsset.assetType) {
        case "image": {
          // 复制所有 imageData 版本
          for (const imgData of sourceAsset.imageDataList || []) {
            await db.insert(imageData).values({
              id: randomUUID(),
              assetId: newAssetId,
              imageUrl: imgData.imageUrl,
              thumbnailUrl: imgData.thumbnailUrl,
              prompt: imgData.prompt,
              seed: imgData.seed,
              modelUsed: imgData.modelUsed,
              generationConfig: imgData.generationConfig,
              sourceAssetIds: imgData.sourceAssetIds,
              isActive: imgData.isActive,
            });
          }
          break;
        }
        case "video": {
          // 复制所有 videoData 版本
          for (const vidData of sourceAsset.videoDataList || []) {
            await db.insert(videoData).values({
              id: randomUUID(),
              assetId: newAssetId,
              videoUrl: vidData.videoUrl,
              thumbnailUrl: vidData.thumbnailUrl,
              duration: vidData.duration,
              prompt: vidData.prompt,
              seed: vidData.seed,
              modelUsed: vidData.modelUsed,
              generationConfig: vidData.generationConfig,
              sourceAssetIds: vidData.sourceAssetIds,
              isActive: vidData.isActive,
            });
          }
          break;
        }
        case "text": {
          if (sourceAsset.textData) {
            await db.insert(textData).values({
              assetId: newAssetId,
              textContent: sourceAsset.textData.textContent,
            });
          }
          break;
        }
        case "audio": {
          if (sourceAsset.audioData) {
            await db.insert(audioData).values({
              assetId: newAssetId,
              audioUrl: sourceAsset.audioData.audioUrl,
              duration: sourceAsset.audioData.duration,
              format: sourceAsset.audioData.format,
              sampleRate: sourceAsset.audioData.sampleRate,
              bitrate: sourceAsset.audioData.bitrate,
              channels: sourceAsset.audioData.channels,
              prompt: sourceAsset.audioData.prompt,
              seed: sourceAsset.audioData.seed,
              modelUsed: sourceAsset.audioData.modelUsed,
              generationConfig: sourceAsset.audioData.generationConfig,
              sourceAssetIds: sourceAsset.audioData.sourceAssetIds,
            });
          }
          break;
        }
      }
    }

    return {
      success: true,
      projectId: newProjectId,
    };
  } catch (error) {
    console.error("复制模板项目失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "复制失败",
    };
  }
}

/**
 * 获取模板项目详情（公开访问，用于只读模式）
 */
export async function getTemplateProjectDetail(templateProjectId: string): Promise<{
  success: boolean;
  project?: Project & {
    template: {
      videoUrl: string | null;
      thumbnail: string | null;
      category: string | null;
    };
  };
  error?: string;
}> {
  try {
    // 验证是模板项目
    const templateInfo = await db.query.projectTemplate.findFirst({
      where: eq(projectTemplate.projectId, templateProjectId),
    });

    if (!templateInfo) {
      return { success: false, error: "该项目不是模板项目" };
    }

    // 获取项目详情
    const projectData = await db.query.project.findFirst({
      where: eq(project.id, templateProjectId),
      with: {
        assets: {
          with: {
            tags: true,
          },
        },
        artStyle: true,
      },
    });

    if (!projectData) {
      return { success: false, error: "项目不存在" };
    }

    return {
      success: true,
      project: {
        ...projectData,
        template: {
          videoUrl: templateInfo.videoUrl,
          thumbnail: templateInfo.thumbnail,
          category: templateInfo.category,
        },
      } as Project & {
        template: {
          videoUrl: string | null;
          thumbnail: string | null;
          category: string | null;
        };
      },
    };
  } catch (error) {
    console.error("获取模板项目详情失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取失败",
    };
  }
}
