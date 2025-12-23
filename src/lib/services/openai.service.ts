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
  role: "system" | "user" | "assistant" | "function" | "tool";
  content: string;
  reasoning_content?: string; // DeepSeek 思考模式的思维链内容
  name?: string; // for function role (deprecated)
  tool_call_id?: string; // for tool role (new format)
  tool_calls?: Array<{  // for assistant role with tool calls (new format)
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  jsonMode?: boolean;
  useReasoning?: boolean; // 是否使用 reasoning 模式（自动选择 OPENAI_REASONING_MODEL）
  functions?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>; // Function calling 定义
  function_call?: "auto" | "none" | { name: string }; // Function calling 模式
}

/**
 * Function Call 结果
 */
export interface FunctionCallResult {
  name: string;
  arguments: string; // JSON 字符串
}

/**
 * Chat Completion 响应
 */
export interface ChatCompletionResult {
  content: string | null;
  functionCall?: FunctionCallResult;
  reasoning?: string; // DeepSeek reasoner 的思考过程
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
    const requestParams: Record<string, unknown> = {
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

    const response = await openai.chat.completions.create(requestParams);
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
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
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

/**
 * 调用 OpenAI Function Calling
 * @param messages 对话历史消息
 * @param functions 可用的 functions
 * @param options 配置选项
 * @returns Chat completion 结果（可能包含 function call）
 */
export async function getChatCompletionWithFunctions(
  messages: ChatMessage[],
  functions: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>,
  options: Omit<ChatCompletionOptions, "functions"> = {},
): Promise<ChatCompletionResult> {
  const {
    model: explicitModel,
    temperature = 0.7,
    maxTokens = 4096,
    jsonMode = false,
    useReasoning = false,
    function_call = "auto",
  } = options;

  // 模型选择（优先使用 chat 模型，因为 reasoner 模型对 function calling 支持有限）
  const model = explicitModel || process.env.OPENAI_CHAT_MODEL || "deepseek-chat";

  try {
    const openai = getOpenAIClient();
    
    // 构建请求参数
    const requestParams: Record<string, unknown> = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      functions,
      function_call,
    };

    // JSON 模式
    if (jsonMode) {
      requestParams.response_format = { type: "json_object" };
    }

    // Reasoning 模式（但 function calling 可能不支持）
    if (useReasoning) {
      requestParams.thinking = { type: "enabled" };
      if (maxTokens < 32000) {
        requestParams.max_tokens = 32000;
      }
    }

    const response = await openai.chat.completions.create(requestParams as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
    const message = response.choices[0]?.message;
    
    if (!message) {
      throw new Error("OpenAI 返回了空消息");
    }

    const result: ChatCompletionResult = {
      content: message.content,
    };

    // 提取 function call
    if (message.function_call) {
      result.functionCall = {
        name: message.function_call.name || "",
        arguments: message.function_call.arguments || "{}",
      };
    }

    // 提取 reasoning（如果有）
    // @ts-expect-error - DeepSeek specific field
    if (message.reasoning_content) {
      // @ts-expect-error - DeepSeek specific field
      result.reasoning = message.reasoning_content;
    }

    return result;
  } catch (error: unknown) {
    console.error("OpenAI Function Calling 失败:", error);
    const message = error instanceof Error ? error.message : "未知错误";
    throw new Error(`AI Function Calling 失败: ${message}`);
  }
}

/**
 * 流式事件类型
 */
export interface StreamChunk {
  type: 'reasoning' | 'content' | 'function_call_name' | 'function_call_arguments' | 'function_call_id' | 'done';
  data: string;
}

/**
 * 流式调用 OpenAI Function Calling
 * @param messages 对话历史消息
 * @param functions 可用的 functions
 * @param options 配置选项
 * @returns AsyncGenerator，逐步 yield 流式数据块
 */
export async function* getChatCompletionWithFunctionsStream(
  messages: ChatMessage[],
  functions: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>,
  options: Omit<ChatCompletionOptions, "functions"> = {},
): AsyncGenerator<StreamChunk> {
  const {
    model: explicitModel,
    temperature = 0.7,
    maxTokens = 4096,
    jsonMode = false,
    useReasoning = false,
    function_call = "auto",
  } = options;

  // 模型选择（优先使用 chat 模型，因为 reasoner 模型对 function calling 支持有限）
  const model = explicitModel || process.env.OPENAI_CHAT_MODEL || "deepseek-chat";

  try {
    const openai = getOpenAIClient();
    
    // 将 functions 转换为 tools 格式（新的 OpenAI API 格式，DeepSeek 思考模式需要）
    const tools = functions.map(func => ({
      type: "function" as const,
      function: {
        name: func.name,
        description: func.description,
        parameters: func.parameters,
      }
    }));
    
    // 构建请求参数
    const requestParams: Record<string, unknown> = {
      model,
      messages,
      max_tokens: useReasoning ? Math.max(maxTokens, 32000) : maxTokens,
      temperature: useReasoning ? undefined : temperature, // thinking 模式不支持 temperature
      tools,  // 使用 tools 而不是 functions
      tool_choice: function_call,  // 使用 tool_choice 而不是 function_call
      stream: true, // 启用流式
    };

    // JSON 模式
    if (jsonMode) {
      requestParams.response_format = { type: "json_object" };
    }

    // Reasoning/Thinking 模式 - 直接在请求参数中添加 thinking 字段
    // DeepSeek API 会识别这个字段
    if (useReasoning) {
      requestParams.thinking = { type: "enabled" };
    }

    // 直接传递请求参数
    // OpenAI SDK 会将未知字段（如 thinking）透传给 API
    const stream = await openai.chat.completions.create(requestParams as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming);
    
    // 逐块处理流式响应
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      
      if (!delta) continue;

      // 处理 reasoning_content (DeepSeek 特有)
      if (delta.reasoning_content) {
        yield { type: 'reasoning', data: delta.reasoning_content };
      }

      // 处理普通 content
      if (delta.content) {
        yield { type: 'content', data: delta.content };
      }

      // 处理 tool_calls (新的 OpenAI API 格式，DeepSeek 思考模式使用)
      if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
        for (const toolCall of delta.tool_calls) {
          // tool call ID
          if (toolCall.id) {
            yield { 
              type: 'function_call_id', 
              data: toolCall.id 
            };
          }
          
          if (toolCall.function) {
            if (toolCall.function.name) {
              yield { 
                type: 'function_call_name', 
                data: toolCall.function.name 
              };
            }
            if (toolCall.function.arguments) {
              yield { 
                type: 'function_call_arguments', 
                data: toolCall.function.arguments 
              };
            }
          }
        }
      }
    }

    // 流结束
    yield { type: 'done', data: '' };

  } catch (error: unknown) {
    console.error("OpenAI Function Calling Stream 失败:", error);
    const message = error instanceof Error ? error.message : "未知错误";
    throw new Error(`AI Function Calling Stream 失败: ${message}`);
  }
}
