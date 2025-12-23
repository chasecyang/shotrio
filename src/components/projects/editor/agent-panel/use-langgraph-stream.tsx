/**
 * LangGraph Stream Hook
 * 
 * 统一的 LangGraph 流式处理 hook
 * 使用单一端点处理新对话和恢复对话
 */

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import type { AgentContext, IterationStep } from "@/types/agent";
import { useAgent } from "./agent-context";

interface UseLangGraphStreamOptions {
  onIterationUpdate?: (iterations: IterationStep[]) => void;
  onPendingAction?: (pendingAction: unknown) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function useLangGraphStream(options: UseLangGraphStreamOptions = {}) {
  const agent = useAgent();
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 发送新消息
   */
  const sendMessage = useCallback(
    async (message: string, context: AgentContext, conversationId: string) => {
      // 创建 abort controller
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/agent/langgraph-stream", {
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
          console.log("[LangGraph Stream] 用户中断");
          options.onError?.("用户中断");
        } else {
          console.error("[LangGraph Stream] 发送消息失败:", error);
          options.onError?.(error instanceof Error ? error.message : "发送失败");
          toast.error("发送失败");
        }
      } finally {
        abortControllerRef.current = null;
      }
    },
    [options]
  );

  /**
   * 恢复对话（确认/拒绝后继续）
   */
  const resumeConversation = useCallback(
    async (threadId: string, approved: boolean, reason?: string) => {
      // 创建 abort controller
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/agent/langgraph-stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            threadId,
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
          console.log("[LangGraph Stream] 用户中断");
          options.onError?.("用户中断");
        } else {
          console.error("[LangGraph Stream] 恢复对话失败:", error);
          options.onError?.(error instanceof Error ? error.message : "恢复失败");
          toast.error("恢复失败");
        }
      } finally {
        abortControllerRef.current = null;
      }
    },
    [options]
  );

  /**
   * 处理流式响应
   */
  const processStream = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
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
            const event = JSON.parse(line);

            switch (event.type) {
              case "user_message_id":
                // 用户消息ID，前端不需要处理
                break;

              case "assistant_message_id":
                currentMessageId = event.data;
                // 创建临时消息，使用后端传来的ID
                agent.addMessage({
                  id: currentMessageId,
                  role: "assistant",
                  content: "",
                  isStreaming: true,
                  iterations: [],
                });
                break;

              case "state_update":
                // 更新状态
                if (currentMessageId && event.data.iterations) {
                  agent.updateMessage(currentMessageId, {
                    iterations: event.data.iterations,
                  });
                  options.onIterationUpdate?.(event.data.iterations);
                }
                break;

              case "interrupt":
                // 需要用户确认
                if (currentMessageId && event.data.pendingAction) {
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

              default:
                console.log("[LangGraph Stream] 未知事件类型:", event.type);
            }
          } catch (error) {
            console.error("[LangGraph Stream] 解析事件失败:", error, line);
          }
        }
      }
    } catch (error) {
      throw error;
    }
  };

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

