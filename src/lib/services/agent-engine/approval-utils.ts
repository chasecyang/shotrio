/**
 * Approval 相关的工具函数
 * 统一管理 approval 逻辑，实现 Event Sourcing
 */

import { getFunctionDefinition } from "@/lib/actions/agent/functions";
import type { EngineMessage } from "@/types/agent";

/**
 * 批量待审批信息
 */
export interface BatchApprovalInfo {
  toolCalls: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  assistantContent: string;
  // 使用第一个 tool call 的信息作为代表
  displayName?: string;
  category: "read" | "generation" | "modification" | "deletion";
}

/**
 * 从消息历史中查找所有待审批的 tool calls
 *
 * 核心逻辑：找到最后一条 assistant 消息中，
 * 所有需要确认且未执行的 tool calls
 */
export function findAllPendingApprovals(messages: EngineMessage[]): BatchApprovalInfo | null {
  // 1. 找到最后一条 assistant 消息
  const lastAssistant = messages
    .filter(m => m.role === "assistant")
    .at(-1);

  if (!lastAssistant?.tool_calls || lastAssistant.tool_calls.length === 0) {
    return null;
  }

  // 2. 收集所有需要确认且未执行的 tool calls
  const pendingToolCalls: BatchApprovalInfo["toolCalls"] = [];
  let firstFuncDef: ReturnType<typeof getFunctionDefinition> | undefined;

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
      pendingToolCalls.push(toolCall);
      if (!firstFuncDef) {
        firstFuncDef = funcDef;
      }
    }
  }

  if (pendingToolCalls.length === 0) {
    return null;
  }

  return {
    toolCalls: pendingToolCalls,
    assistantContent: lastAssistant.content || "",
    displayName: firstFuncDef?.displayName,
    category: firstFuncDef?.category || "generation",
  };
}

/**
 * 检查对话是否处于等待审批状态
 */
export function isAwaitingApproval(messages: EngineMessage[]): boolean {
  const batch = findAllPendingApprovals(messages);
  return batch !== null && batch.toolCalls.length > 0;
}
