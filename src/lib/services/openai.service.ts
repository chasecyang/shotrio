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
  useReasoning?: boolean; // 是否使用 reasoning 模式（自动选择 OPENAI_REASONING_MODEL）
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
    model: explicitModel,
    temperature = 0.7,
    maxTokens = 4096,
    jsonMode = false,
    useReasoning = false,
  } = options;

  // 模型选择逻辑：
  // 1. 如果明确指定了 model，使用指定的 model
  // 2. 如果 useReasoning=true，使用 OPENAI_REASONING_MODEL (thinking 模型)
  // 3. 否则使用 OPENAI_CHAT_MODEL (chat 模型)
  let model: string;
  if (explicitModel) {
    model = explicitModel;
  } else if (useReasoning) {
    model = process.env.OPENAI_REASONING_MODEL || "deepseek-reasoner";
  } else {
    model = process.env.OPENAI_CHAT_MODEL || "deepseek-chat";
  }

  try {
    const openai = getOpenAIClient();
    
    // 构建请求参数
    const requestParams: {
      model: string;
      messages: Array<{ role: string; content: string }>;
      max_tokens?: number;
      response_format?: { type: string };
      temperature?: number;
      thinking?: { type: string }; // 用于 DeepSeek reasoning 模式
    } = {
      model,
      messages,
      max_tokens: maxTokens,
      response_format: jsonMode ? { type: "json_object" } : undefined,
    };

    // 检测是否是 reasoner 模型
    const isReasonerModel = model.includes('reasoner');
    
    // 如果使用 reasoning 模式或检测到 reasoner 模型，添加 thinking 参数
    if (useReasoning || isReasonerModel) {
      requestParams.thinking = { type: "enabled" };
      // reasoning 模式下，max_tokens 建议设置为 32K 或 64K
      if (maxTokens < 32000) {
        requestParams.max_tokens = 32000;
      }
      // reasoner 模式不支持 response_format
      if (isReasonerModel && jsonMode) {
        console.warn("⚠️ reasoner 模型不支持 JSON 模式，已自动禁用");
        requestParams.response_format = undefined;
      }
    } else {
      // 非 reasoning 模式才设置 temperature
      requestParams.temperature = temperature;
    }

    console.log("OpenAI请求:", {
      model,
      jsonMode,
      maxTokens: requestParams.max_tokens,
      useReasoning: useReasoning || isReasonerModel,
    });
    
    const response = await openai.chat.completions.create(requestParams);
    
    console.log("OpenAI响应:", {
      id: response.id,
      model: response.model,
      finish_reason: response.choices[0]?.finish_reason,
      contentLength: response.choices[0]?.message?.content?.length || 0,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error(`OpenAI返回了空内容，finish_reason: ${response.choices[0]?.finish_reason || 'unknown'}`);
    }

    return content;
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
    model: explicitModel,
    temperature = 0.7,
    maxTokens = 4096,
    useReasoning = false,
  } = options;

  // 使用与 getChatCompletion 相同的模型选择逻辑
  const model = explicitModel 
    ? explicitModel
    : useReasoning
    ? process.env.OPENAI_REASONING_MODEL || "deepseek-reasoner"
    : process.env.OPENAI_CHAT_MODEL || "deepseek-chat";

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
