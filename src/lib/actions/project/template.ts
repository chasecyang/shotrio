"use server";

import db from "@/lib/db";
import { project, projectTemplate } from "@/lib/db/schemas/project";
import { desc, isNotNull } from "drizzle-orm";

/**
 * 模板预览信息（用于首页展示）
 */
export interface TemplatePreview {
  projectId: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  thumbnail: string | null;
  category: string | null;
  styleName: string | null;
  assetCount: number;
}

/**
 * 获取公开模板列表（用于首页展示）
 * 无需登录即可访问
 */
export async function getPublicTemplates(options?: {
  category?: string;
  limit?: number;
}): Promise<TemplatePreview[]> {
  try {
    const templates = await db.query.projectTemplate.findMany({
      orderBy: [desc(projectTemplate.order), desc(projectTemplate.createdAt)],
      with: {
        project: {
          with: {
            assets: true,
            artStyle: true,
          },
        },
      },
      ...(options?.limit ? { limit: options.limit } : {}),
    });

    // 过滤分类（如果指定）
    let filtered = templates;
    if (options?.category) {
      filtered = templates.filter((t) => t.category === options.category);
    }

    return filtered.map((t) => {
      const proj = t.project as {
        title: string;
        description: string | null;
        assets?: unknown[];
        artStyle?: { name: string } | null;
      };
      return {
        projectId: t.projectId,
        title: proj.title,
        description: proj.description,
        videoUrl: t.videoUrl,
        thumbnail: t.thumbnail,
        category: t.category,
        styleName: proj.artStyle?.name ?? null,
        assetCount: proj.assets?.length ?? 0,
      };
    });
  } catch (error) {
    console.error("获取模板列表失败:", error);
    return [];
  }
}

/**
 * 获取模板分类列表
 */
export async function getTemplateCategories(): Promise<string[]> {
  try {
    const templates = await db.query.projectTemplate.findMany({
      where: isNotNull(projectTemplate.category),
    });

    const categories = new Set<string>();
    for (const t of templates) {
      if (t.category) {
        categories.add(t.category);
      }
    }

    return Array.from(categories);
  } catch (error) {
    console.error("获取模板分类失败:", error);
    return [];
  }
}

/**
 * 检查项目是否为模板
 */
export async function isTemplateProject(projectId: string): Promise<boolean> {
  try {
    const template = await db.query.projectTemplate.findFirst({
      where: (t, { eq }) => eq(t.projectId, projectId),
    });
    return !!template;
  } catch (error) {
    console.error("检查模板状态失败:", error);
    return false;
  }
}
