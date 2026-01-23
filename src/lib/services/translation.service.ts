/**
 * Translation Service
 *
 * 用于将中文提示词翻译成英文，以便调用图片/视频生成 API
 */

import OpenAI from "openai";

/**
 * 检测文本是否包含中文字符
 */
export function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text);
}

/**
 * 将中文提示词翻译成英文
 *
 * @param chinesePrompt 中文提示词
 * @returns 英文提示词
 */
export async function translatePromptToEnglish(chinesePrompt: string): Promise<string> {
  // 如果不包含中文，直接返回
  if (!containsChinese(chinesePrompt)) {
    return chinesePrompt;
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional translator specializing in AI image/video generation prompts.

Translation Rules:
1. Translate Chinese descriptions to English while preserving technical details and camera parameters
2. Keep technical terms in English (like "50mm", "f/2.8", "bokeh", etc.)
3. **CRITICAL**: Preserve text content that should appear in the image (signs, labels, book titles, etc.):
   - Text in quotes (single or double) should NOT be translated
   - Text after phrases like "写着", "上面写着", "标着", "显示", "文字是" should NOT be translated
   - Examples:
     * "招牌上写着'香港烧鹅饭'" → "A sign that says '香港烧鹅饭'"
     * "书的封面上写着《红楼梦》" → "A book cover that says '红楼梦'"
     * "T恤上印着'我爱北京'" → "A T-shirt with text '我爱北京'"

Output only the translated English prompt without any explanations.`,
        },
        {
          role: "user",
          content: chinesePrompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const translatedPrompt = response.choices[0]?.message?.content?.trim();

    if (!translatedPrompt) {
      console.warn("[Translation] 翻译结果为空，使用原始提示词");
      return chinesePrompt;
    }

    console.log("[Translation] 翻译成功:", {
      original: chinesePrompt,
      translated: translatedPrompt,
    });

    return translatedPrompt;
  } catch (error) {
    console.error("[Translation] 翻译失败，使用原始提示词:", error);
    return chinesePrompt;
  }
}
