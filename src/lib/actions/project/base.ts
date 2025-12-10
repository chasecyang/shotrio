"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { project } from "@/lib/db/schemas/project";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import {
  type NewProject,
  type ProjectWithStats,
  type ProjectDetail,
} from "@/types/project";

/**
 * 创建新项目
 */
export async function createProject(data: {
  title: string;
  description?: string;
  stylePrompt?: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const newProject: NewProject = {
      id: randomUUID(),
      userId: session.user.id,
      title: data.title,
      description: data.description,
      stylePrompt: data.stylePrompt,
      status: "draft",
    };

    const [created] = await db.insert(project).values(newProject).returning();

    revalidatePath("/projects");
    return { success: true, data: created };
  } catch (error) {
    console.error("创建项目失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建失败",
    };
  }
}

/**
 * 获取用户的所有项目（带统计数据）
 */
export async function getUserProjects(): Promise<ProjectWithStats[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return [];
  }

  try {
    const projects = await db.query.project.findMany({
      where: eq(project.userId, session.user.id),
      orderBy: [desc(project.updatedAt)],
      with: {
        episodes: true,
        characters: true,
      },
    });

    return projects.map((p) => ({
      ...p,
      episodeCount: p.episodes.length,
      characterCount: p.characters.length,
    }));
  } catch (error) {
    console.error("获取项目列表失败:", error);
    return [];
  }
}

/**
 * 获取项目详情（含剧集和角色）
 */
export async function getProjectDetail(
  projectId: string,
): Promise<ProjectDetail | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const projectData = await db.query.project.findFirst({
      where: and(
        eq(project.id, projectId),
        eq(project.userId, session.user.id),
      ),
      with: {
        episodes: {
          orderBy: (episodes, { asc }) => [asc(episodes.order)],
        },
        characters: {
          with: {
            images: {
              orderBy: (images, { desc }) => [desc(images.isPrimary), desc(images.createdAt)],
            },
          },
        },
        scenes: {
          with: {
            images: {
              orderBy: (images, { desc }) => [desc(images.createdAt)],
            },
          },
        },
      },
    });

    return projectData || null;
  } catch (error) {
    console.error("获取项目详情失败:", error);
    return null;
  }
}

/**
 * 更新项目
 */
export async function updateProject(
  projectId: string,
  data: Partial<NewProject>,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const [updated] = await db
      .update(project)
      .set(data)
      .where(and(eq(project.id, projectId), eq(project.userId, session.user.id)))
      .returning();

    revalidatePath(`/projects/${projectId}`);
    return { success: true, data: updated };
  } catch (error) {
    console.error("更新项目失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新失败",
    };
  }
}

/**
 * 删除项目
 */
export async function deleteProject(projectId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    await db
      .delete(project)
      .where(
        and(eq(project.id, projectId), eq(project.userId, session.user.id)),
      );

    revalidatePath("/projects");
    return { success: true };
  } catch (error) {
    console.error("删除项目失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    };
  }
}
