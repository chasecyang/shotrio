"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { character, characterImage, project } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

/**
 * 创建新的角色造型（不自动生成图片）
 * 图片需要用户手动触发生成
 */
export async function createCharacterStyle(
  projectId: string,
  characterId: string,
  data: {
    label: string;
    stylePrompt: string;
  }
): Promise<{ success: boolean; imageId?: string; error?: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
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
      return { success: false, error: "项目不存在或无权限" };
    }

    // 验证角色存在且属于该项目
    const characterData = await db.query.character.findFirst({
      where: eq(character.id, characterId),
      with: {
        images: true,
      },
    });

    if (!characterData || characterData.projectId !== projectId) {
      return { success: false, error: "角色不存在或不属于该项目" };
    }

    // 创建造型记录（imageUrl 为 null，待生成）
    const imageId = randomUUID();
    const isPrimary = characterData.images.length === 0; // 如果是第一个造型，设为主图

    await db.insert(characterImage).values({
      id: imageId,
      characterId,
      label: data.label,
      imagePrompt: data.stylePrompt,
      imageUrl: null, // 待生成
      seed: null,
      isPrimary,
    });

    console.log("✅ 造型创建成功:", { imageId, characterId, label: data.label });

    // 重新验证所有语言版本的页面
    revalidatePath(`/zh/projects/${projectId}/characters`);
    revalidatePath(`/en/projects/${projectId}/characters`);

    console.log("✅ 缓存已清除");

    return {
      success: true,
      imageId,
    };
  } catch (error) {
    console.error("创建角色造型失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建角色造型失败",
    };
  }
}

/**
 * 更新角色基本信息
 */
export async function updateCharacterInfo(
  projectId: string,
  characterId: string,
  data: {
    name?: string;
    description?: string;
    appearance?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
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
      return { success: false, error: "项目不存在或无权限" };
    }

    // 验证角色存在且属于该项目
    const characterData = await db.query.character.findFirst({
      where: eq(character.id, characterId),
    });

    if (!characterData || characterData.projectId !== projectId) {
      return { success: false, error: "角色不存在或不属于该项目" };
    }

    // 更新角色信息
    const updateData: {
      name?: string;
      description?: string | null;
      appearance?: string | null;
    } = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.description !== undefined) {
      updateData.description = data.description || null;
    }
    if (data.appearance !== undefined) {
      updateData.appearance = data.appearance || null;
    }

    await db
      .update(character)
      .set(updateData)
      .where(eq(character.id, characterId));

    // 重新验证所有语言版本的页面
    revalidatePath(`/zh/projects/${projectId}/characters`);
    revalidatePath(`/en/projects/${projectId}/characters`);

    return { success: true };
  } catch (error) {
    console.error("更新角色信息失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新角色信息失败",
    };
  }
}

/**
 * 更新角色造型信息
 */
export async function updateCharacterStyleInfo(
  projectId: string,
  imageId: string,
  data: {
    label?: string;
    imagePrompt?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
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
      return { success: false, error: "项目不存在或无权限" };
    }

    // 验证造型存在且属于该项目的角色
    const imageData = await db.query.characterImage.findFirst({
      where: eq(characterImage.id, imageId),
      with: {
        character: true,
      },
    });

    // 类型断言：character 是一个对象而不是数组
    const characterData = imageData?.character as { projectId: string } | undefined;
    if (!imageData || !characterData || characterData.projectId !== projectId) {
      return { success: false, error: "造型不存在或不属于该项目" };
    }

    // 更新造型信息
    const updateData: {
      label?: string;
      imagePrompt?: string | null;
    } = {};

    if (data.label !== undefined) {
      updateData.label = data.label;
    }
    if (data.imagePrompt !== undefined) {
      updateData.imagePrompt = data.imagePrompt || null;
    }

    await db
      .update(characterImage)
      .set(updateData)
      .where(eq(characterImage.id, imageId));

    // 重新验证所有语言版本的页面
    revalidatePath(`/zh/projects/${projectId}/characters`);
    revalidatePath(`/en/projects/${projectId}/characters`);

    return { success: true };
  } catch (error) {
    console.error("更新造型信息失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新造型信息失败",
    };
  }
}
