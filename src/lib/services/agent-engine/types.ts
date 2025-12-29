/**
 * Agent Engine 类型定义
 */

import type { AgentContext, EngineMessage } from "@/types/agent";
import type { CreditCost } from "@/lib/utils/credit-calculator";

/**
 * 使用统一的 Message 类型
 * @deprecated 使用 EngineMessage 替代
 */
export type Message = EngineMessage;

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
 * 流式事件类型
 */
export type AgentStreamEvent =
  | { type: "user_message_id"; data: string }
  | { type: "assistant_message_id"; data: string }
  | { type: "content_delta"; data: string }
  | { type: "tool_call_start"; data: { id: string; name: string; displayName?: string } }
  | { type: "tool_call_end"; data: { id: string; name: string; success: boolean; result?: string; error?: string } }
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
  pendingAction?: PendingActionInfo; // 运行时从消息历史推导，不持久化到数据库
  assistantMessageId?: string;
}

