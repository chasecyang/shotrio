/**
 * Approval 相关的工具函数
 * 统一管理 approval 逻辑，实现 Event Sourcing
 */

import { getFunctionDefinition } from "@/lib/actions/agent/functions";
import type { EngineMessage } from "@/types/agent";

/**
 * 待审批信息
 */
export interface ApprovalInfo {
  toolCall: {
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  };
  assistantContent: string;
  displayName?: string;
  category: "read" | "generation" | "modification" | "deletion";
}

/**
 * 从消息历史中查找待审批的 tool call
 * 
 * 核心逻辑：找到最后一条 assistant 消息中，
 * 第一个需要确认且未执行的 tool call
 */
export function findPendingApproval(messages: EngineMessage[]): ApprovalInfo | null {
  // 1. 找到最后一条 assistant 消息
  const lastAssistant = messages
    .filter(m => m.role === "assistant")
    .at(-1);

  if (!lastAssistant?.tool_calls || lastAssistant.tool_calls.length === 0) {
    return null;
  }

  // 2. 遍历 tool_calls，找到第一个需要确认且未执行的
  for (const toolCall of lastAssistant.tool_calls) {
    // 检查是否已有对应的 tool message
    const hasToolMessage = messages.some(
      m => m.role === "tool" && m.tool_call_id === toolCall.id
    );
    
    if (hasToolMessage) {
      continue; // 已执行，跳过
    }

    // 检查是否需要确认
    const funcDef = getFunctionDefinition(toolCall.function.name);
    if (funcDef?.needsConfirmation) {
      return {
        toolCall,
        assistantContent: lastAssistant.content || "",
        displayName: funcDef.displayName,
        category: funcDef.category,
      };
    }
  }

  return null;
}

/**
 * 检查对话是否处于等待审批状态
 */
export function isAwaitingApproval(messages: EngineMessage[]): boolean {
  return findPendingApproval(messages) !== null;
}

/**
 * 获取需要确认的 tool call（用于执行）
 * 返回原始的 tool call 对象
 */
export function getPendingToolCall(messages: EngineMessage[]) {
  const approval = findPendingApproval(messages);
  return approval?.toolCall || null;
}

