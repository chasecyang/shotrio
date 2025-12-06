import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY 未配置");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });
  }

  return openaiClient;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  jsonMode?: boolean;
}

/**
 * 调用OpenAI聊天完成接口
 * @param messages 对话历史消息
 * @param options 配置选项
 * @returns AI回复内容
 */
export async function getChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<string> {
  const {
    model = process.env.OPENAI_MODEL || "gpt-3.5-turbo",
    temperature = 0.7,
    maxTokens = 4096,
    jsonMode = false,
  } = options;

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: jsonMode ? { type: "json_object" } : undefined,
    });

    return response.choices[0]?.message?.content || "";
  } catch (error: unknown) {
    console.error("OpenAI API调用失败:", error);
    const message = error instanceof Error ? error.message : "未知错误";
    throw new Error(`AI对话失败: ${message}`);
  }
}

/**
 * 流式调用OpenAI聊天完成接口
 * @param messages 对话历史消息
 * @param options 配置选项
 * @returns 流式响应
 */
export async function getChatCompletionStream(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
) {
  const {
    model = process.env.OPENAI_MODEL || "gpt-3.5-turbo",
    temperature = 0.7,
    maxTokens = 4096,
  } = options;

  try {
    const openai = getOpenAIClient();
    const stream = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    });

    return stream;
  } catch (error: unknown) {
    console.error("OpenAI API流式调用失败:", error);
    const message = error instanceof Error ? error.message : "未知错误";
    throw new Error(`AI对话失败: ${message}`);
  }
}

/**
 * 构建对话上下文
 * @param systemPrompt 系统提示词（应该已经包含所有必要的指令）
 * @param history 历史对话记录
 * @param maxHistory 最大历史记录数
 * @returns 格式化的消息列表
 */
export function buildChatContext(
  systemPrompt: string,
  history: Array<{ sender: string; content: string }>,
  maxHistory: number = 20,
): ChatMessage[] {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
  ];

  // 只取最近的n条历史记录
  const recentHistory = history.slice(-maxHistory);

  for (const msg of recentHistory) {
    messages.push({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.content,
    });
  }

  return messages;
}
