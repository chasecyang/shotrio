/**
 * Gemini Provider 实现
 * 基于 Kie.ai Gemini 3 Flash API
 */

import { getKieApiKey } from "@/lib/services/kie/config";
import type { EngineMessage } from "@/types/agent";
import type {
  AgentProvider,
  AgentTool,
  AgentProviderOptions,
  AgentStreamChunk,
} from "./types";

const GEMINI_API_URL =
  "https://api.kie.ai/gemini-3-flash/v1/chat/completions";

type GeminiMessageRole = "developer" | "system" | "user" | "assistant" | "tool";

interface GeminiMessage {
  role: GeminiMessageRole;
  content: string | Array<{ type: "text"; text: string }>;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface GeminiStreamChunk {
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: "function";
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
}

/**
 * 转换 EngineMessage 到 Gemini 格式
 */
function convertToGeminiMessages(messages: EngineMessage[]): GeminiMessage[] {
  return messages.map((msg) => {
    // tool 消息：content 使用字符串格式
    if (msg.tool_call_id) {
      return {
        role: "tool" as GeminiMessageRole,
        content: msg.content,
        tool_call_id: msg.tool_call_id,
      };
    }

    // assistant 消息带 tool_calls：content 为空时使用字符串格式
    // 因为 API 不接受 [{ type: "text", text: "" }] 格式
    if (msg.role === "assistant" && msg.tool_calls) {
      return {
        role: "assistant" as GeminiMessageRole,
        content: msg.content || "",
        tool_calls: msg.tool_calls,
      };
    }

    // 其他消息：使用数组格式（支持多模态）
    return {
      role: msg.role as GeminiMessageRole,
      content: msg.content
        ? [{ type: "text" as const, text: msg.content }]
        : msg.content,
    };
  });
}

/**
 * Gemini Provider
 */
export class GeminiProvider implements AgentProvider {
  async *streamChat(
    messages: EngineMessage[],
    tools: AgentTool[],
    options: AgentProviderOptions = {}
  ): AsyncGenerator<AgentStreamChunk> {
    const geminiMessages = convertToGeminiMessages(messages);

    const body = {
      messages: geminiMessages,
      stream: true,
      include_thoughts: true,
      reasoning_effort: "low" as const,
      ...(tools.length > 0 ? { tools } : {}),
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
        if (done) {
          break;
        }

        const decoded = decoder.decode(value, { stream: true });
        buffer += decoded;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;

          // 检查是否是错误响应（非 SSE 格式）
          if (!trimmed.startsWith("data: ")) {
            try {
              const errorResponse = JSON.parse(trimmed);
              if (errorResponse.code && errorResponse.msg) {
                throw new Error(
                  `Gemini API error: ${errorResponse.code} - ${errorResponse.msg}`
                );
              }
            } catch (e) {
              if (e instanceof Error && e.message.startsWith("Gemini API error")) {
                throw e;
              }
              // 不是 JSON 或不是错误格式，忽略
            }
            continue;
          }

          const jsonStr = trimmed.slice(6);
          try {
            const chunk: GeminiStreamChunk = JSON.parse(jsonStr);
            const choice = chunk.choices[0];
            if (!choice) continue;

            const delta = choice.delta;

            yield {
              delta: {
                content: delta?.content || undefined,
                reasoningContent: delta?.reasoning_content || undefined,
                toolCalls: delta?.tool_calls?.map((tc) => ({
                  index: tc.index,
                  id: tc.id,
                  type: tc.type,
                  function: tc.function
                    ? {
                        name: tc.function.name,
                        arguments: tc.function.arguments,
                      }
                    : undefined,
                })),
              },
              finishReason: choice.finish_reason,
            };
          } catch {
            // JSON parse error, skip this line
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
