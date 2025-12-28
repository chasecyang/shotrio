"use server";

import { getChatCompletion } from "@/lib/services/openai.service";

/**
 * 优化或生成剧集梗概
 */
export async function optimizeEpisodeSummary(
  title: string,
  scriptContent: string = ""
): Promise<{ success: boolean; summary?: string; error?: string }> {
  try {
    // 构建 Prompt
    const systemPrompt = `你是一位资深微短剧编剧，擅长提炼核心剧情和制造悬念。
    
# 你的任务
根据提供的剧集信息（标题、剧本内容），生成或优化一段【50字以内】的剧情梗概。

# 要求
1. **精炼**：严格控制在50字以内。
2. **核心事件**：概括本集发生的最主要事件。
3. **悬念感**：语言要有张力，体现微短剧的快节奏和反转。
4. **输出**：直接返回梗概内容，不要包含任何解释性文字或引号。`;

    const userPrompt = `剧集信息如下：
- 标题：${title}
${scriptContent ? `- 剧本内容：${scriptContent}` : ''}

请生成该集的剧情梗概：`;

    // 调用 OpenAI API
    const response = await getChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.7,
        maxTokens: 200, // 限制 token 数，确保简短
        jsonMode: false,
      }
    );

    const summary = response.trim();

    return {
      success: true,
      summary,
    };
  } catch (error) {
    console.error("生成梗概失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "生成梗概失败",
    };
  }
}

/**
 * 优化或生成剧本内容
 */
export async function optimizeEpisodeScript(
  title: string,
  summary: string = "",
  currentScript: string = ""
): Promise<{ success: boolean; script?: string; error?: string }> {
  try {
    const systemPrompt = `你是一位专业微短剧编剧，擅长创作快节奏、强冲突的剧本。

# 你的任务
根据提供的剧集信息，创作或润色本集的完整剧本。

# 创作要求
1. **格式**：标准的剧本格式（场景+人物+对话+动作）。
2. **节奏**：极快，避免废话，三句话一个小冲突，五句话一个大反转。
3. **时长**：控制在1-2分钟的阅读量。
4. **结尾**：必须留下悬念。
5. **输出**：直接返回剧本内容。`;

    const userPrompt = `剧集信息如下：
- 标题：${title}
${summary ? `- 梗概：${summary}` : ''}
${currentScript ? `- 原有剧本（请在此基础上优化）：\n${currentScript}` : ''}

请生成/优化完整剧本：`;

    const response = await getChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.7,
        maxTokens: 2000,
        jsonMode: false,
      }
    );

    return {
      success: true,
      script: response.trim(),
    };
  } catch (error) {
    console.error("生成剧本失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "生成剧本失败",
    };
  }
}
