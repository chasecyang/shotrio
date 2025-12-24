/**
 * Agent Stream Hook
 * 
 * 简化版的 Agent 流式处理 hook，连接新的 /api/agent/stream
 */

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import type { AgentContext, IterationStep, AgentMessage } from "@/types/agent";
import { useAgent } from "./agent-context";
import type { AgentStreamEvent } from "@/lib/services/agent-engine";

interface UseAgentStreamOptions {
  onIterationUpdate?: (iterations: IterationStep[]) => void;
  onPendingAction?: (pendingAction: unknown) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function useAgentStream(options: UseAgentStreamOptions = {}) {
  const agent = useAgent();
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 处理流式响应
   */
  const processStream = useCallback(async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    const decoder = new TextDecoder();
    let buffer = "";
    let currentMessageId: string | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event: AgentStreamEvent = JSON.parse(line);

            switch (event.type) {
              case "user_message_id":
                // 用户消息ID，前端不需要处理
                break;

              case "assistant_message_id":
                currentMessageId = event.data;
                if (currentMessageId) {
                  // 检查是否已经有这个消息（恢复对话时）
                  const existingMessage = agent.state.messages.find(m => m.id === currentMessageId);
                  if (existingMessage) {
                    // 如果已经存在，只更新状态
                    console.log("[Agent Stream] 复用已有消息:", currentMessageId);
                    agent.updateMessage(currentMessageId, {
                      isStreaming: true,
                      pendingAction: undefined, // 清除pendingAction
                    });
                  } else {
                    // 如果不存在，创建新消息
                    console.log("[Agent Stream] 创建新消息:", currentMessageId);
                    agent.addMessage({
                      id: currentMessageId,
                      role: "assistant",
                      content: "",
                      isStreaming: true,
                      iterations: [],
                    });
                  }
                }
                break;

              case "state_update":
                // 更新状态
                if (currentMessageId && event.data.iterations) {
                  const updates: Partial<AgentMessage> = {
                    iterations: event.data.iterations,
                  };
                  
                  // 如果 state_update 包含 pendingAction 字段（包括 undefined），则更新它
                  // 这允许后端通过发送 pendingAction: undefined 来清除前端状态
                  if ("pendingAction" in event.data) {
                    if (event.data.pendingAction === undefined) {
                      // 明确清除 pendingAction
                      updates.pendingAction = undefined;
                      console.log("[Agent Stream] 清除 pendingAction");
                    } else {
                      // 检查是否需要更新 pendingAction
                      const currentMessage = agent.state.messages.find(m => m.id === currentMessageId);
                      const existingPendingActionId = currentMessage?.pendingAction?.id;
                      const newPendingActionId = event.data.pendingAction.id;
                      
                      // 如果 pendingAction 已存在且 id 相同，跳过更新
                      if (existingPendingActionId !== newPendingActionId) {
                        updates.pendingAction = event.data.pendingAction;
                      } else {
                        console.log("[Agent Stream] state_update: pendingAction 已存在，跳过重复设置:", newPendingActionId);
                      }
                    }
                  }
                  
                  agent.updateMessage(currentMessageId, updates);
                  options.onIterationUpdate?.(event.data.iterations);
                }
                break;

              case "interrupt":
                // 需要用户确认
                if (currentMessageId && event.data.pendingAction) {
                  const currentMessage = agent.state.messages.find(m => m.id === currentMessageId);
                  
                  // 检查是否已经存在相同的 pendingAction（通过 id 判断）
                  const existingPendingActionId = currentMessage?.pendingAction?.id;
                  const newPendingActionId = event.data.pendingAction.id;
                  
                  // 如果 pendingAction 已存在且 id 相同，跳过更新
                  if (existingPendingActionId === newPendingActionId) {
                    console.log("[Agent Stream] pendingAction 已存在，跳过重复设置:", newPendingActionId);
                    break;
                  }
                  
                  agent.updateMessage(currentMessageId, {
                    pendingAction: event.data.pendingAction,
                    isStreaming: false,
                  });
                  options.onPendingAction?.(event.data.pendingAction);
                }
                break;

              case "complete":
                // 完成
                if (currentMessageId) {
                  agent.updateMessage(currentMessageId, {
                    isStreaming: false,
                  });
                }
                options.onComplete?.();
                break;

              case "error":
                // 错误
                options.onError?.(event.data);
                toast.error(event.data);
                break;

              default: {
                const _exhaustiveCheck: never = event;
                console.log("[Agent Stream] 未知事件类型:", _exhaustiveCheck);
                break;
              }
            }
          } catch (error) {
            console.error("[Agent Stream] 解析事件失败:", error, line);
          }
        }
      }
    } catch (error) {
      throw error;
    }
  }, [agent, options]);

  /**
   * 发送新消息
   */
  const sendMessage = useCallback(
    async (message: string, context: AgentContext, conversationId: string) => {
      // 创建 abort controller
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/agent/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            context,
            conversationId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("无法读取响应流");
        }

        await processStream(reader);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("[Agent Stream] 用户中断");
          options.onError?.("用户中断");
        } else {
          console.error("[Agent Stream] 发送消息失败:", error);
          options.onError?.(error instanceof Error ? error.message : "发送失败");
          toast.error("发送失败");
        }
      } finally {
        abortControllerRef.current = null;
      }
    },
    [processStream, options]
  );

  /**
   * 恢复对话（确认/拒绝后继续）
   */
  const resumeConversation = useCallback(
    async (conversationId: string, approved: boolean, reason?: string) => {
      // 不再手动清除 pendingAction，让后端通过 state_update 事件统一管理
      
      // 创建 abort controller
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/agent/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            resumeConversationId: conversationId,
            resumeValue: {
              approved,
              reason,
            },
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("无法读取响应流");
        }

        await processStream(reader);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("[Agent Stream] 用户中断");
          options.onError?.("用户中断");
        } else {
          console.error("[Agent Stream] 恢复对话失败:", error);
          options.onError?.(error instanceof Error ? error.message : "恢复失败");
          toast.error("恢复失败");
        }
      } finally {
        abortControllerRef.current = null;
      }
    },
    [processStream, options]
  );

  /**
   * 中断流
   */
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    sendMessage,
    resumeConversation,
    abort,
    isStreaming: abortControllerRef.current !== null,
  };
}

