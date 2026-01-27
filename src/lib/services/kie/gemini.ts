// Kie Gemini 3 Flash Chat Completions API
// 原生实现，不使用 OpenAI 客户端

import { getKieApiKey } from "./config";

const GEMINI_API_URL = "https://api.kie.ai/gemini-3-flash/v1/chat/completions";

// ============ Types ============

export type GeminiMessageRole =
  | "developer"
  | "system"
  | "user"
  | "assistant"
  | "tool";

export type GeminiReasoningEffort = "low" | "high";

export interface GeminiTextContent {
  type: "text";
  text: string;
}

export interface GeminiImageContent {
  type: "image_url";
  image_url: {
    url: string;
  };
}

export type GeminiContentPart = GeminiTextContent | GeminiImageContent;

export interface GeminiMessage {
  role: GeminiMessageRole;
  content: string | GeminiContentPart[];
}

export interface GeminiFunctionDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface GeminiTool {
  type: "function";
  function: GeminiFunctionDefinition;
}

export interface GeminiChatRequest {
  messages: GeminiMessage[];
  stream?: boolean;
  include_thoughts?: boolean;
  reasoning_effort?: GeminiReasoningEffort;
  tools?: GeminiTool[];
}

export interface GeminiChoiceDelta {
  role?: "assistant";
  content?: string;
  reasoning_content?: string;
}

export interface GeminiStreamChoice {
  index: number;
  delta: GeminiChoiceDelta;
  finish_reason?: "stop" | null;
}

export interface GeminiUsageDetails {
  audio_tokens: number;
  text_tokens: number;
  reasoning_tokens: number;
}

export interface GeminiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  completion_tokens_details: GeminiUsageDetails;
  total_tokens: number;
}

export interface GeminiStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: GeminiStreamChoice[];
  credits_consumed?: number;
  usage?: GeminiUsage;
  system_fingerprint?: string;
}

// Non-streaming response types
export interface GeminiResponseMessage {
  role: "assistant";
  content: string;
  reasoning_content?: string;
}

export interface GeminiResponseChoice {
  index: number;
  message: GeminiResponseMessage;
  finish_reason: "stop";
}

export interface GeminiChatResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: GeminiResponseChoice[];
  usage: GeminiUsage;
  credits_consumed: number;
}

export interface GeminiChatOptions {
  includeThoughts?: boolean;
  reasoningEffort?: GeminiReasoningEffort;
  tools?: GeminiTool[];
}

export interface GeminiChatResult {
  content: string;
  reasoningContent?: string;
  usage?: GeminiUsage;
}

// ============ API Functions ============

/**
 * 非流式调用 Gemini 3 Flash Chat Completions API
 */
export async function geminiChat(
  messages: GeminiMessage[],
  options: GeminiChatOptions = {}
): Promise<GeminiChatResult> {
  const { includeThoughts = false, reasoningEffort = "high", tools } = options;

  const body: GeminiChatRequest = {
    messages,
    stream: false,
    include_thoughts: includeThoughts,
    reasoning_effort: reasoningEffort,
    ...(tools && tools.length > 0 ? { tools } : {}),
  };

  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getKieApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data: GeminiChatResponse = await response.json();
  const choice = data.choices[0];

  if (!choice?.message?.content) {
    throw new Error("Gemini API returned empty content");
  }

  return {
    content: choice.message.content,
    reasoningContent: choice.message.reasoning_content,
    usage: data.usage,
  };
}

/**
 * 流式调用 Gemini 3 Flash Chat Completions API
 * 返回 AsyncGenerator，可以逐块获取响应
 */
export async function* geminiChatStream(
  messages: GeminiMessage[],
  options: GeminiChatOptions = {}
): AsyncGenerator<GeminiStreamChunk, void, unknown> {
  const { includeThoughts = true, reasoningEffort = "high", tools } = options;

  const body: GeminiChatRequest = {
    messages,
    stream: true,
    include_thoughts: includeThoughts,
    reasoning_effort: reasoningEffort,
    ...(tools && tools.length > 0 ? { tools } : {}),
  };

  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getKieApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;

        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6);
          try {
            const chunk: GeminiStreamChunk = JSON.parse(jsonStr);
            yield chunk;
          } catch {
            // Skip invalid JSON chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 流式调用并收集完整响应
 * 提供 onContent 和 onReasoning 回调用于实时处理
 */
export async function geminiChatStreamCollect(
  messages: GeminiMessage[],
  options: GeminiChatOptions & {
    onContent?: (content: string) => void;
    onReasoning?: (reasoning: string) => void;
  } = {}
): Promise<GeminiChatResult> {
  const { onContent, onReasoning, ...chatOptions } = options;

  let fullContent = "";
  let fullReasoning = "";
  let usage: GeminiUsage | undefined;

  for await (const chunk of geminiChatStream(messages, chatOptions)) {
    const delta = chunk.choices[0]?.delta;

    if (delta?.content) {
      fullContent += delta.content;
      onContent?.(delta.content);
    }

    if (delta?.reasoning_content) {
      fullReasoning += delta.reasoning_content;
      onReasoning?.(delta.reasoning_content);
    }

    if (chunk.usage) {
      usage = chunk.usage;
    }
  }

  return {
    content: fullContent,
    reasoningContent: fullReasoning || undefined,
    usage,
  };
}

// ============ Helper Functions ============

/**
 * 创建文本消息
 */
export function createTextMessage(
  role: GeminiMessageRole,
  text: string
): GeminiMessage {
  return { role, content: text };
}

/**
 * 创建带图片的消息
 */
export function createImageMessage(
  role: GeminiMessageRole,
  text: string,
  imageUrls: string[]
): GeminiMessage {
  const content: GeminiContentPart[] = [{ type: "text", text }];

  for (const url of imageUrls) {
    content.push({
      type: "image_url",
      image_url: { url },
    });
  }

  return { role, content };
}
