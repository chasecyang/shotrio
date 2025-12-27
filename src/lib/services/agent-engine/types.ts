/**
 * Agent Engine 类型定义
 */

import type { AgentContext } from "@/types/agent";
import type { CreditCost } from "@/lib/utils/credit-calculator";

/**
 * OpenAI-compatible message types
 */
export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: MessageRole;
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string; // for tool messages
}

/**
 * 迭代信息
 */
export interface IterationInfo {
  id: string;
  iterationNumber: number;
  content?: string;
  functionCall?: {
    id: string;
    name: string;
    displayName?: string;
    description?: string;
    category: string;
    status: "pending" | "executing" | "completed" | "failed";
    result?: string;
    error?: string;
  };
  timestamp: Date;
}

/**
 * 待执行操作信息
 */
export interface PendingActionInfo {
  id: string;
  functionCall: {
    id: string;
    name: string;
    displayName?: string;
    arguments: Record<string, unknown>;
    category: string;
  };
  message: string;
  creditCost?: CreditCost;
  createdAt: Date;
}

/**
 * 执行状态
 */
export type ExecutionState = "thinking" | "tool_call" | "awaiting_approval" | "completed";

/**
 * 流式事件类型
 */
export type AgentStreamEvent =
  | { type: "user_message_id"; data: string }
  | { type: "assistant_message_id"; data: string }
  | { type: "state_update"; data: { iterations: IterationInfo[]; currentIteration: number; pendingAction?: PendingActionInfo } }
  | { type: "interrupt"; data: { action: "approval_required"; pendingAction: PendingActionInfo } }
  | { type: "complete"; data: "done" | "pending_confirmation" }
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
  messages: Message[];
  iterations: IterationInfo[];
  currentIteration: number;
  pendingAction?: PendingActionInfo;
  assistantMessageId?: string;
}

