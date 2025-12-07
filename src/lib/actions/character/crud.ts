"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { character, project } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

/**
 * 创建或更新角色 (Upsert)
 * 只处理文字设定，不处理图片
 */
export async function upsertCharacter(
  projectId: string,
  data: {
    id?: string;
    name: string;
    description?: string;
    appearance?: string;
  }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证项目权限
    const projectData = await db.query.project.findFirst({
      where: and(
        eq(project.id, projectId),
        eq(project.userId, session.user.id)
      ),
    });

    if (!projectData) {
      throw new Error("项目不存在或无权限");
    }

    if (data.id) {
      // 更新
      await db
        .update(character)
        .set({
          name: data.name,
          description: data.description,
          appearance: data.appearance,
        })
        .where(eq(character.id, data.id));
    } else {
      // 创建
      await db.insert(character).values({
        id: randomUUID(),
        projectId,
        name: data.name,
        description: data.description,
        appearance: data.appearance,
      });
    }

    revalidatePath(`/projects/${projectId}/characters`);
    return { success: true };
  } catch (error) {
    console.error("保存角色失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "保存角色失败",
    };
  }
}

/**
 * 删除角色
 */
export async function deleteCharacter(projectId: string, characterId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证项目权限
    const projectData = await db.query.project.findFirst({
      where: and(
        eq(project.id, projectId),
        eq(project.userId, session.user.id)
      ),
    });

    if (!projectData) {
      throw new Error("项目不存在或无权限");
    }

    await db.delete(character).where(eq(character.id, characterId));

    revalidatePath(`/projects/${projectId}/characters`);
    return { success: true };
  } catch (error) {
    console.error("删除角色失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除角色失败",
    };
  }
}
