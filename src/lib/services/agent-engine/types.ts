/**
 * Agent Engine 类型定义
 */

import type { AgentContext, EngineMessage } from "@/types/agent";

/**
 * 流式事件类型
 */
export type AgentStreamEvent =
  | { type: "user_message_id"; data: string }
  | { type: "assistant_message_id"; data: string }
  | { type: "content_delta"; data: string }
  | { type: "tool_call_start"; data: { id: string; name: string; displayName?: string; arguments: string } }
  | { type: "tool_call_end"; data: { id: string; name: string; success: boolean; result?: string; error?: string } }
  | { type: "interrupt"; data: { action: "approval_required" } }
  | { type: "complete"; data: "done" | "pending_confirmation" | "rejected" }
  | { type: "error"; data: string };

/**
 * Agent 引擎配置
 */
export interface AgentEngineConfig {
  maxIterations?: number; // 最大迭代次数，防止无限循环
  modelName?: string; // OpenAI 模型名称
}

/**
 * 对话状态（内存中）
 */
export interface ConversationState {
  conversationId: string;
  projectContext: AgentContext;
  messages: EngineMessage[];
  assistantMessageId?: string;
}

