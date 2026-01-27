"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { AgentMessage } from "@/types/agent";
import { getFunctionDefinition } from "@/lib/actions/agent/functions";
import { formatFunctionResult, type TranslationFunction } from "@/lib/services/agent-engine/result-formatter";

export interface DisplayStep {
  id: string;
  type: "thinking" | "reasoning" | "tool_call";
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    displayName?: string;
    status: "executing" | "completed" | "failed" | "rejected" | "awaiting_confirmation";
    result?: string;
    error?: string;
  };
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
          steps.push({
            id: `${msg.id}-reasoning`,
            type: "reasoning",
            content: msg.reasoningContent,
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

        // 2. Tool 调用（如果有）
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          const toolCall = msg.toolCalls[0];
          const funcDef = getFunctionDefinition(toolCall.function.name);

          // ✅ 使用 toolCallId 精确查找对应的 tool 响应（而不是依赖位置 i+1）
          const toolResponse = messages.find(
            m => m.role === "tool" && m.toolCallId === toolCall.id
          );

          let status: "executing" | "completed" | "failed" | "rejected" | "awaiting_confirmation" = "executing";
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

          steps.push({
            id: `${msg.id}-tool`,
            type: "tool_call",
            toolCall: {
              id: toolCall.id,
              name: toolCall.function.name,
              displayName: translateDisplayName(funcDef?.displayName),
              status,
              result,
              error,
            },
          });
        }

        if (steps.length > 0) {
          displays.push({ messageId: msg.id, steps });
        }
      }
    }

    return displays;
  }, [messages, translateFn, translateDisplayName]);
}
