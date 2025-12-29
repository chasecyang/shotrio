"use client";

import { useMemo } from "react";
import type { AgentMessage } from "@/types/agent";
import { getFunctionDefinition } from "@/lib/actions/agent/functions";
import { formatFunctionResult } from "@/lib/services/agent-engine/result-formatter";

export interface DisplayStep {
  id: string;
  type: "thinking" | "tool_call";
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    displayName?: string;
    status: "executing" | "completed" | "failed" | "awaiting_confirmation";
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
  return useMemo(() => {
    const displays: Array<{messageId: string; steps: DisplayStep[]}> = [];
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      if (msg.role === "assistant") {
        const steps: DisplayStep[] = [];
        
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
          
          let status: "executing" | "completed" | "failed" | "awaiting_confirmation" = "executing";
          let result: string | undefined;
          let error: string | undefined;
          
          if (toolResponse) {
            try {
              const parsedResult = JSON.parse(toolResponse.content);
              status = parsedResult.success ? "completed" : "failed";
              
              if (parsedResult.success) {
                result = formatFunctionResult(
                  toolCall.function.name,
                  JSON.parse(toolCall.function.arguments),
                  parsedResult.data
                );
              } else {
                error = parsedResult.error;
              }
            } catch (e) {
              console.error("[useMessageDisplay] 解析 tool 响应失败:", e);
              status = "failed";
              error = "解析响应失败";
            }
          } else if (msg.pendingAction && msg.pendingAction.functionCall.id === toolCall.id) {
            // 没有响应，但有 pendingAction 且 ID 匹配，说明等待用户确认
            status = "awaiting_confirmation";
          }
          
          steps.push({
            id: `${msg.id}-tool`,
            type: "tool_call",
            toolCall: {
              id: toolCall.id,
              name: toolCall.function.name,
              displayName: funcDef?.displayName,
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
  }, [messages]);
}

