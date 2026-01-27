/**
 * OpenAI Provider 实现
 */

import OpenAI from "openai";
import type { EngineMessage } from "@/types/agent";
import type {
  AgentProvider,
  AgentTool,
  AgentProviderOptions,
  AgentStreamChunk,
} from "./types";

/**
 * 获取 OpenAI 客户端实例
 */
function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY 未配置");
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });
}

/**
 * 获取模型名称
 */
function getModelName(): string {
  return (
    process.env.OPENAI_AGENT_MODEL ||
    process.env.OPENAI_REASONING_MODEL ||
    process.env.OPENAI_CHAT_MODEL ||
    "deepseek-chat"
  );
}

/**
 * OpenAI Provider
 */
export class OpenAIProvider implements AgentProvider {
  async *streamChat(
    messages: EngineMessage[],
    tools: AgentTool[],
    options: AgentProviderOptions = {}
  ): AsyncGenerator<AgentStreamChunk> {
    const openai = getOpenAIClient();
    const { temperature = 0.7, maxTokens = 4096 } = options;

    const stream = await openai.chat.completions.create({
      model: getModelName(),
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      tools: tools.length > 0 ? tools : undefined,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta = choice.delta;

      yield {
        delta: {
          content: delta?.content || undefined,
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
    }
  }
}
