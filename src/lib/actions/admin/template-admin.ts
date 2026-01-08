"use server";

import db from "@/lib/db";
import { project, projectTemplate } from "@/lib/db/schemas/project";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/auth-utils";

/**
 * 将项目标记为模板
 */
export async function markProjectAsTemplate(
  projectId: string,
  options: {
    videoUrl?: string;
    thumbnail?: string;
    category?: string;
    order?: number;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // 验证管理员权限
    await requireAdmin();

    // 验证项目存在
    const projectData = await db.query.project.findFirst({
      where: eq(project.id, projectId),
    });

    if (!projectData) {
      return { success: false, error: "项目不存在" };
    }

    // 检查是否已经是模板
    const existing = await db.query.projectTemplate.findFirst({
      where: eq(projectTemplate.projectId, projectId),
    });

    if (existing) {
      // 更新模板信息
      await db
        .update(projectTemplate)
        .set({
          videoUrl: options.videoUrl ?? existing.videoUrl,
          thumbnail: options.thumbnail ?? existing.thumbnail,
          category: options.category ?? existing.category,
          order: options.order ?? existing.order,
        })
        .where(eq(projectTemplate.projectId, projectId));
    } else {
      // 创建模板记录
      await db.insert(projectTemplate).values({
        projectId,
        videoUrl: options.videoUrl ?? null,
        thumbnail: options.thumbnail ?? null,
        category: options.category ?? null,
        order: options.order ?? 0,
      });
    }

    return { success: true };
  } catch (error) {
    console.error("标记模板失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "标记失败",
    };
  }
}

/**
 * 取消项目的模板标记
 */
export async function unmarkProjectAsTemplate(projectId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // 验证管理员权限
    await requireAdmin();

    await db
      .delete(projectTemplate)
      .where(eq(projectTemplate.projectId, projectId));

    return { success: true };
  } catch (error) {
    console.error("取消模板标记失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "取消失败",
    };
  }
}

/**
 * 更新模板信息
 */
export async function updateTemplateInfo(
  projectId: string,
  data: {
    videoUrl?: string;
    thumbnail?: string;
    category?: string;
    order?: number;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // 验证管理员权限
    await requireAdmin();

    const existing = await db.query.projectTemplate.findFirst({
      where: eq(projectTemplate.projectId, projectId),
    });

    if (!existing) {
      return { success: false, error: "模板不存在" };
    }

    await db
      .update(projectTemplate)
      .set({
        ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl }),
        ...(data.thumbnail !== undefined && { thumbnail: data.thumbnail }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.order !== undefined && { order: data.order }),
      })
      .where(eq(projectTemplate.projectId, projectId));

    return { success: true };
  } catch (error) {
    console.error("更新模板信息失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新失败",
    };
  }
}

/**
 * 获取所有模板项目（管理员用）
 */
export async function getAllTemplateProjects(): Promise<{
  success: boolean;
  templates?: Array<{
    projectId: string;
    title: string;
    description: string | null;
    videoUrl: string | null;
    thumbnail: string | null;
    category: string | null;
    order: number;
    assetCount: number;
    createdAt: Date;
  }>;
  error?: string;
}> {
  try {
    // 验证管理员权限
    await requireAdmin();

    const templates = await db.query.projectTemplate.findMany({
      orderBy: [desc(projectTemplate.order), desc(projectTemplate.createdAt)],
      with: {
        project: {
          with: {
            assets: true,
          },
        },
      },
    });

    return {
      success: true,
      templates: templates.map((t) => {
        const proj = t.project as {
          title: string;
          description: string | null;
          assets?: unknown[];
        };
        return {
          projectId: t.projectId,
          title: proj.title,
          description: proj.description,
          videoUrl: t.videoUrl,
          thumbnail: t.thumbnail,
          category: t.category,
          order: t.order,
          assetCount: proj.assets?.length ?? 0,
          createdAt: t.createdAt,
        };
      }),
    };
  } catch (error) {
    console.error("获取模板列表失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取失败",
    };
  }
}

/**
 * 获取可以标记为模板的项目列表（管理员自己的项目）
 */
export async function getAdminProjects(): Promise<{
  success: boolean;
  projects?: Array<{
    id: string;
    title: string;
    description: string | null;
    isTemplate: boolean;
    assetCount: number;
  }>;
  error?: string;
}> {
  try {
    // 验证管理员权限
    const admin = await requireAdmin();

    const projects = await db.query.project.findMany({
      where: eq(project.userId, admin.id),
      orderBy: [desc(project.updatedAt)],
      with: {
        assets: true,
        template: true,
      },
    });

    return {
      success: true,
      projects: projects.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        isTemplate: !!p.template,
        assetCount: p.assets?.length ?? 0,
      })),
    };
  } catch (error) {
    console.error("获取管理员项目列表失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取失败",
    };
  }
}
