/**
 * Agent Provider 抽象层类型定义
 */

import type { EngineMessage } from "@/types/agent";

/**
 * 工具定义
 */
export interface AgentTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * 流式响应中的工具调用增量
 */
export interface AgentToolCallDelta {
  index: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

/**
 * 流式响应增量
 */
export interface AgentStreamDelta {
  content?: string;
  reasoningContent?: string;
  toolCalls?: AgentToolCallDelta[];
}

/**
 * 流式响应 chunk
 */
export interface AgentStreamChunk {
  delta: AgentStreamDelta;
  finishReason?: string | null;
}

/**
 * Provider 配置选项
 */
export interface AgentProviderOptions {
  temperature?: number;
  maxTokens?: number;
}

/**
 * Agent Provider 接口
 */
export interface AgentProvider {
  /**
   * 流式聊天完成
   */
  streamChat(
    messages: EngineMessage[],
    tools: AgentTool[],
    options?: AgentProviderOptions
  ): AsyncGenerator<AgentStreamChunk>;
}
