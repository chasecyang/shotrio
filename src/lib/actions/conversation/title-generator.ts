"use server";

import { getChatCompletion } from "@/lib/services/openai.service";

/**
 * 根据用户消息生成对话标题
 * @param userMessage 用户的第一条消息
 * @returns 生成的对话标题
 */
export async function generateConversationTitle(
  userMessage: string
): Promise<string> {
  try {
    const systemPrompt = `你是一个对话标题生成专家。你的任务是根据用户的第一条消息，生成一个简洁、准确的对话标题。

要求：
1. **长度**：10-20字符，中文
2. **准确性**：准确概括用户的意图或需求
3. **简洁性**：直接、明了，避免冗长的描述
4. **可读性**：使用自然的语言，避免生硬的翻译感

示例：
- 用户消息："帮我生成一个角色三视图" → 标题："生成角色三视图"
- 用户消息："我想为第一集的第3个镜头生成分镜图" → 标题："生成第1集第3镜分镜图"
- 用户消息："帮我看看项目中有哪些素材" → 标题："查看项目素材"
- 用户消息："我要创建一个咖啡厅的场景素材" → 标题："创建咖啡厅场景"

直接返回标题，不要包含任何解释性文字或引号。`;

    const userPrompt = `用户消息：${userMessage}

请生成对话标题：`;

    const response = await getChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.7,
        maxTokens: 100,
        jsonMode: false,
      }
    );

    const title = response.trim();

    // 验证标题长度，如果太长则截断
    if (title.length > 30) {
      return title.substring(0, 30);
    }

    // 如果标题为空或太短，返回默认标题
    if (!title || title.length < 2) {
      return generateFallbackTitle();
    }

    return title;
  } catch (error) {
    console.error("[TitleGenerator] 生成标题失败:", error);
    return generateFallbackTitle();
  }
}

/**
 * 生成默认标题（fallback）
 */
function generateFallbackTitle(): string {
  const now = new Date();
  return `对话 ${now.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

