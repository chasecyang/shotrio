"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { AgentMessage } from "@/types/agent";
import { getFunctionDefinition } from "@/lib/actions/agent/functions";
import { formatFunctionResult, type TranslationFunction } from "@/lib/services/agent-engine/result-formatter";

export type ToolCallStatus = "executing" | "completed" | "failed" | "rejected" | "awaiting_confirmation";

export interface ToolCallInfo {
  id: string;
  name: string;
  displayName?: string;
  arguments: string;
  status: ToolCallStatus;
  result?: string;
  error?: string;
}

export interface DisplayStep {
  id: string;
  type: "thinking" | "reasoning" | "tool_call";
  content?: string;
  isComplete?: boolean; // 标识该步骤是否已完成（用于控制 loading 状态）
  // 单个 tool call（向后兼容）
  toolCall?: {
    id: string;
    name: string;
    displayName?: string;
    status: ToolCallStatus;
    result?: string;
    error?: string;
  };
  // 多个 tool calls（批量模式）
  toolCalls?: ToolCallInfo[];
}

/**
 * 从原始 messages 构建前端展示结构
 *
 * 将消息流转换为可展示的步骤列表：
 * - assistant 消息 → thinking step (如果有 content)
 * - assistant 消息 + tool_calls → tool_call step
 * - tool 消息 → 更新对应 tool_call step 的状态
 */
export function useMessageDisplay(messages: AgentMessage[]) {
  const t = useTranslations("agent.functionResult");
  const tDisplayNames = useTranslations("editor.agent.toolExecution.displayNames");

  // Create translation function for formatFunctionResult
  const translateFn: TranslationFunction = (key, params) => {
    return t(key, params as Record<string, string | number>);
  };

  // Translate displayName key to localized string
  const translateDisplayName = (displayNameKey: string | undefined): string | undefined => {
    if (!displayNameKey) return undefined;
    // Check if translation exists, otherwise return the key as fallback
    try {
      return tDisplayNames(displayNameKey as Parameters<typeof tDisplayNames>[0]);
    } catch {
      return displayNameKey;
    }
  };

  return useMemo(() => {
    const displays: Array<{messageId: string; steps: DisplayStep[]}> = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      if (msg.role === "assistant") {
        const steps: DisplayStep[] = [];

        // 0. AI 的思考过程（Gemini reasoning）
        if (msg.reasoningContent) {
          // reasoning 完成的标志：消息有 content 或 toolCalls，说明已经进入下一阶段
          const isReasoningComplete = !!(msg.content || (msg.toolCalls && msg.toolCalls.length > 0));
          steps.push({
            id: `${msg.id}-reasoning`,
            type: "reasoning",
            content: msg.reasoningContent,
            isComplete: isReasoningComplete,
          });
        }

        // 1. AI 的思考内容
        if (msg.content) {
          steps.push({
            id: `${msg.id}-content`,
            type: "thinking",
            content: msg.content,
          });
        }

        // 2. Tool 调用（如果有）- 支持多个 tool calls
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          const toolCallInfos: ToolCallInfo[] = [];

          for (const toolCall of msg.toolCalls) {
            const funcDef = getFunctionDefinition(toolCall.function.name);

            // 使用 toolCallId 精确查找对应的 tool 响应
            const toolResponse = messages.find(
              m => m.role === "tool" && m.toolCallId === toolCall.id
            );

            let status: ToolCallStatus = "executing";
            let result: string | undefined;
            let error: string | undefined;

            if (toolResponse) {
              try {
                const parsedResult = JSON.parse(toolResponse.content);

                if (parsedResult.success) {
                  status = "completed";
                  result = formatFunctionResult(
                    toolCall.function.name,
                    JSON.parse(toolCall.function.arguments),
                    parsedResult.data,
                    translateFn
                  );
                } else if (parsedResult.userRejected) {
                  status = "rejected";
                  error = parsedResult.error;
                } else {
                  status = "failed";
                  error = parsedResult.error;
                }
              } catch (e) {
                console.error("[useMessageDisplay] Failed to parse tool response:", e);
                status = "failed";
                error = "PARSE_RESPONSE_FAILED";
              }
            } else if (funcDef?.needsConfirmation) {
              // 没有响应，但函数需要确认，说明等待用户确认
              status = "awaiting_confirmation";
            }

            toolCallInfos.push({
              id: toolCall.id,
              name: toolCall.function.name,
              displayName: translateDisplayName(funcDef?.displayName),
              arguments: toolCall.function.arguments,
              status,
              result,
              error,
            });
          }

          // 如果只有一个 tool call，保持向后兼容
          if (toolCallInfos.length === 1) {
            const tc = toolCallInfos[0];
            steps.push({
              id: `${msg.id}-tool`,
              type: "tool_call",
              toolCall: {
                id: tc.id,
                name: tc.name,
                displayName: tc.displayName,
                status: tc.status,
                result: tc.result,
                error: tc.error,
              },
            });
          } else {
            // 多个 tool calls，使用批量模式
            steps.push({
              id: `${msg.id}-tools`,
              type: "tool_call",
              toolCalls: toolCallInfos,
            });
          }
        }

        if (steps.length > 0) {
          displays.push({ messageId: msg.id, steps });
        }
      }
    }

    return displays;
  }, [messages, translateFn, translateDisplayName]);
}
