"use server";

import db from "@/lib/db";
import { character } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { getChatCompletion } from "@/lib/services/openai.service";

/**
 * AI生成或优化角色造型描述
 * 基于角色基础信息和简单描述，生成专业的英文图像生成prompt
 */
export async function generateStylePrompt(params: {
  characterId: string;
  simpleDescription?: string; // 用户输入的简单中文描述
  currentPrompt?: string; // 当前已有的prompt（优化模式）
  mode?: "generate" | "optimize"; // 生成模式或优化模式
}): Promise<{ success: boolean; prompt?: string; error?: string }> {
  const {
    characterId,
    simpleDescription = "",
    currentPrompt = "",
    mode = "generate",
  } = params;

  try {
    // 1. 获取角色基础信息
    const characterData = await db.query.character.findFirst({
      where: eq(character.id, characterId),
    });

    if (!characterData) {
      return { success: false, error: "角色不存在" };
    }

    // 2. 构建AI Prompt
    const systemPrompt = `你是一位专业的AI图像生成prompt专家，精通Stable Diffusion、FLUX等AI绘图工具的提示词撰写。

# 你的任务
${
  mode === "optimize"
    ? "优化已有的角色造型描述，使其更专业、更适合AI图像生成。"
    : "基于角色基础信息和用户的简单描述，生成专业的英文图像生成prompt。"
}

# 输出要求
1. **语言**：必须使用英文输出
2. **重点**：聚焦于【可变元素】（服装、配饰、妆容、姿势、表情、场景）
3. **避免**：不要重复角色的固定特征（如发色、瞳色、身高等，这些已在基础外貌中定义）
4. **长度**：避免冗余，言简意赅

# 输出格式
直接返回生成的英文prompt，不要包含任何解释、引号或额外文字。`;

    let userPrompt = "";

    if (mode === "optimize") {
      userPrompt = `角色信息：
- 角色名称：${characterData.name}
- 基础外貌（固定特征）：${characterData.appearance || "未设定"}
- 当前造型描述：${currentPrompt}

请优化这个造型描述，使其更专业、更适合AI图像生成：`;
    } else {
      userPrompt = `角色信息：
- 角色名称：${characterData.name}
- 性格描述：${characterData.description || "未设定"}
- 基础外貌（固定特征）：${characterData.appearance || "未设定"}
${simpleDescription ? `- 用户描述：${simpleDescription}` : ""}

请生成专业的英文图像生成prompt：`;
    }

    // 3. 调用OpenAI API
    const response = await getChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.7,
        maxTokens: 500,
        jsonMode: false,
      }
    );

    const generatedPrompt = response.trim();

    return {
      success: true,
      prompt: generatedPrompt,
    };
  } catch (error) {
    console.error("生成造型描述失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "生成描述失败",
    };
  }
}

/**
 * 快捷方法：生成造型描述（基于简单描述）
 */
export async function generateStylePromptFromDescription(
  characterId: string,
  simpleDescription: string
): Promise<{ success: boolean; prompt?: string; error?: string }> {
  return generateStylePrompt({
    characterId,
    simpleDescription,
    mode: "generate",
  });
}

/**
 * 快捷方法：优化现有造型描述
 */
export async function optimizeStylePrompt(
  characterId: string,
  currentPrompt: string
): Promise<{ success: boolean; prompt?: string; error?: string }> {
  return generateStylePrompt({
    characterId,
    currentPrompt,
    mode: "optimize",
  });
}

