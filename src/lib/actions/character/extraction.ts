"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { character, characterImage, project, episode } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { getChatCompletion } from "@/lib/services/openai.service";
import type { 
  CharacterExtractionResult, 
  ExtractedCharacter
} from "@/types/project";

/**
 * 从剧本中提取角色信息（同步版本）
 * 分析所有剧集的scriptContent，使用AI提取角色和造型描述
 */
export async function extractCharactersFromScript(
  projectId: string
): Promise<{ success: boolean; data?: CharacterExtractionResult; error?: string }> {
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
        episodes: {
          orderBy: [episode.order],
        },
      },
    });

    if (!projectData) {
      return { success: false, error: "项目不存在或无权限" };
    }

    if (!projectData.episodes || projectData.episodes.length === 0) {
      return { success: false, error: "项目中没有剧集内容" };
    }

    // 收集所有剧集的剧本内容
    const scriptContents = projectData.episodes
      .filter(ep => ep.scriptContent)
      .map(ep => `【第${ep.order}集：${ep.title}】\n${ep.scriptContent}`)
      .join("\n\n---\n\n");

    if (!scriptContents.trim()) {
      return { success: false, error: "剧集中没有剧本内容" };
    }

    // 构建AI提示词
    const systemPrompt = `你是一位专业的角色设计专家，擅长从剧本中提取角色信息并生成图像描述。

# 任务目标
分析提供的微短剧剧本，提取所有主要角色的信息和造型变化。

# 提取要求

1. **角色识别**
   - 识别剧本中所有出现的主要角色（至少出现2次以上）
   - 提取角色的中文名称

2. **基础信息**
   - 性格描述：50字以内，概括角色的核心性格特征
   - 基础外貌：描述固定不变的特征（如发色、瞳色、身高、体型、种族特征等）

3. **造型分析**
   - 分析角色在不同场景下的造型变化
   - 每个角色提取2-5个典型造型
   - 造型应该包含：服装风格、配饰、妆容、情绪状态等可变元素

4. **图像Prompt生成**
   - 为每个造型生成专业的英文图像生成prompt
   - 遵循结构：人物基础特征 + 服装描述 + 场景氛围 + 艺术风格
   - 适合用于Stable Diffusion等AI绘图工具
   - 包含必要的质量标签：如 "high quality, detailed, professional photography"

# 输出格式
严格按照以下JSON格式返回：

{
  "characters": [
    {
      "name": "角色中文名",
      "description": "性格描述（50字以内）",
      "appearance": "基础外貌描述（中文，固定特征）",
      "styles": [
        {
          "label": "造型名称（如：日常装、工作装、晚礼服）",
          "prompt": "详细的英文图像生成prompt"
        }
      ]
    }
  ]
}

# 注意事项
- 只提取主要角色，配角可以忽略
- 造型名称要简洁明了，便于用户识别
- 英文prompt要专业、详细，包含足够的视觉细节
- 如果剧本中没有明确描述外貌，可以根据角色性格和身份合理推测
- 确保JSON格式正确，可以被解析`;

    const userPrompt = `请分析以下微短剧剧本，提取所有主要角色信息：

${scriptContents}

请严格按照JSON格式返回提取结果。`;

    // 调用OpenAI API
    const response = await getChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.7,
        maxTokens: 6000,
        jsonMode: true,
      }
    );

    // 解析JSON响应
    const result = JSON.parse(response) as CharacterExtractionResult;

    // 验证结果格式
    if (!result.characters || !Array.isArray(result.characters)) {
      throw new Error("AI返回的数据格式不正确");
    }

    // 验证并清理数据
    const validatedCharacters = result.characters
      .filter(char => char.name && char.name.trim())
      .map(char => ({
        name: char.name.trim(),
        description: char.description || "",
        appearance: char.appearance || "",
        styles: (char.styles || [])
          .filter(style => style.label && style.prompt)
          .map(style => ({
            label: style.label.trim(),
            prompt: style.prompt.trim(),
          })),
      }))
      .filter(char => char.styles.length > 0); // 只保留有造型的角色

    if (validatedCharacters.length === 0) {
      return { 
        success: false, 
        error: "未能从剧本中提取到有效的角色信息，请确保剧本内容中包含角色描述" 
      };
    }

    return {
      success: true,
      data: {
        characters: validatedCharacters,
      },
    };
  } catch (error) {
    console.error("提取角色失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "提取角色失败",
    };
  }
}

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
          existingStyles.map(img => img.label.toLowerCase().trim())
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

    revalidatePath(`/projects/${projectId}/characters`);

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
