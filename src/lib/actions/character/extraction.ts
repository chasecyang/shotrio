"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { character, characterImage, project } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { ExtractedCharacter } from "@/types/project";

/**
 * 批量导入提取的角色
 * 智能合并：已存在的角色只添加新造型，不存在的角色新建
 */
export async function importExtractedCharacters(
  projectId: string,
  characters: ExtractedCharacter[]
): Promise<{ 
  success: boolean; 
  imported?: { newCharacters: number; newStyles: number; updatedCharacters: number }; 
  error?: string 
}> {
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
      with: {
        characters: {
          with: {
            images: true,
          },
        },
      },
    });

    if (!projectData) {
      return { success: false, error: "项目不存在或无权限" };
    }

    // 统计信息
    let newCharactersCount = 0;
    let newStylesCount = 0;
    let updatedCharactersCount = 0;

    // 使用事务处理批量导入
    await db.transaction(async (tx) => {
      for (const extractedChar of characters) {
        // 查找是否已存在同名角色（模糊匹配）
        const existingChar = projectData.characters.find(
          char => char.name.toLowerCase().trim() === extractedChar.name.toLowerCase().trim()
        );

        let characterId: string;

        if (existingChar) {
          // 角色已存在，更新信息并添加新造型
          characterId = existingChar.id;
          
          // 如果提取的描述或外貌信息更详细，则更新
          const shouldUpdate = 
            (extractedChar.description && extractedChar.description.length > (existingChar.description?.length || 0)) ||
            (extractedChar.appearance && extractedChar.appearance.length > (existingChar.appearance?.length || 0));

          if (shouldUpdate) {
            await tx
              .update(character)
              .set({
                description: extractedChar.description || existingChar.description,
                appearance: extractedChar.appearance || existingChar.appearance,
              })
              .where(eq(character.id, characterId));
          }

          updatedCharactersCount++;
        } else {
          // 创建新角色
          characterId = randomUUID();
          await tx.insert(character).values({
            id: characterId,
            projectId,
            name: extractedChar.name,
            description: extractedChar.description,
            appearance: extractedChar.appearance,
          });

          newCharactersCount++;
        }

        // 添加造型（去重）
        const existingStyles = existingChar?.images || [];
        const existingLabels = new Set(
          existingStyles.map((img: { label: string }) => img.label.toLowerCase().trim())
        );

        for (const style of extractedChar.styles) {
          // 检查是否已存在相同label的造型
          if (!existingLabels.has(style.label.toLowerCase().trim())) {
            await tx.insert(characterImage).values({
              id: randomUUID(),
              characterId,
              label: style.label,
              imagePrompt: style.prompt,
              imageUrl: null, // 待生成
              seed: null,
              isPrimary: existingStyles.length === 0 && newStylesCount === 0, // 第一个造型设为主图
            });

            newStylesCount++;
          }
        }
      }
    });

    return {
      success: true,
      imported: {
        newCharacters: newCharactersCount,
        newStyles: newStylesCount,
        updatedCharacters: updatedCharactersCount,
      },
    };
  } catch (error) {
    console.error("导入角色失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "导入角色失败",
    };
  }
}
