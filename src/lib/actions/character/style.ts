"use server";

import db from "@/lib/db";
import { character, characterImage } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { 
  requireAuthAndProject, 
  revalidateCharactersPage,
  withErrorHandling 
} from "@/lib/actions/utils";

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
  return withErrorHandling(async () => {
    // 验证登录和项目权限
    await requireAuthAndProject(projectId);

    // 验证角色存在且属于该项目
    const characterData = await db.query.character.findFirst({
      where: eq(character.id, characterId),
      with: {
        images: true,
      },
    });

    if (!characterData || characterData.projectId !== projectId) {
      throw new Error("角色不存在或不属于该项目");
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

    // 重新验证页面
    revalidateCharactersPage(projectId);

    console.log("✅ 缓存已清除");

    return {
      success: true,
      imageId,
    };
  }, "创建角色造型失败");
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
  return withErrorHandling(async () => {
    // 验证登录和项目权限
    await requireAuthAndProject(projectId);

    // 验证角色存在且属于该项目
    const characterData = await db.query.character.findFirst({
      where: eq(character.id, characterId),
    });

    if (!characterData || characterData.projectId !== projectId) {
      throw new Error("角色不存在或不属于该项目");
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

    // 重新验证页面
    revalidateCharactersPage(projectId);

    return { success: true };
  }, "更新角色信息失败");
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
  return withErrorHandling(async () => {
    // 验证登录和项目权限
    await requireAuthAndProject(projectId);

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
      throw new Error("造型不存在或不属于该项目");
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

    // 重新验证页面
    revalidateCharactersPage(projectId);

    return { success: true };
  }, "更新造型信息失败");
}
