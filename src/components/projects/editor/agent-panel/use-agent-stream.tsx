/**
 * Agent Stream Hook
 * 
 * 简化版的 Agent 流式处理 hook，连接新的 /api/agent/stream
 * 
 * 修复：使用 ref 替代闭包中的 state 查找，避免 React 闭包陷阱
 */

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import type { AgentContext, AgentMessage } from "@/types/agent";
import { useAgent } from "./agent-context";
import type { AgentStreamEvent } from "@/lib/services/agent-engine";

interface UseAgentStreamOptions {
  onFirstAssistantMessage?: () => void;
  onPendingAction?: () => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  onToolCallEnd?: (toolName: string, success: boolean) => void;
}

/**
 * 流式消息状态（存储在 ref 中，避免闭包问题）
 */
interface StreamState {
  messageId: string | null;
  content: string;
  toolCalls: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export function useAgentStream(options: UseAgentStreamOptions = {}) {
  const agent = useAgent();
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // 使用 ref 存储当前流式消息的状态，避免闭包陷阱
  const streamStateRef = useRef<StreamState>({
    messageId: null,
    content: "",
    toolCalls: [],
  });
  
  // 标记是否已触发首条消息回调，避免重复触发
  const firstAssistantMessageTriggeredRef = useRef<boolean>(false);

  /**
   * 处理流式响应
   */
  const processStream = useCallback(async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    const decoder = new TextDecoder();
    let buffer = "";

    // 重置流状态
    streamStateRef.current = {
      messageId: null,
      content: "",
      toolCalls: [],
    };
    
    // 重置首条消息触发标记
    firstAssistantMessageTriggeredRef.current = false;

    // 添加超时保护（5分钟）
    const timeoutId = setTimeout(() => {
      console.error("[Agent Stream] 超时，强制结束流");
      reader.cancel();
      if (streamStateRef.current.messageId) {
        agent.updateMessage(streamStateRef.current.messageId, { isStreaming: false });
      }
      agent.setLoading(false);
      options.onError?.("响应超时");
    }, 5 * 60 * 1000);

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

              case "assistant_message_id": {
                const messageId = event.data;
                if (!messageId) break;
                
                // 更新当前messageId
                streamStateRef.current.messageId = messageId;
                
                // 检查是否已经有这个消息（恢复对话时）
                const existingMessage = agent.state.messages.find(m => m.id === messageId);
                if (existingMessage) {
                  // 恢复已有消息（用于恢复对话场景）
                  console.log("[Agent Stream] 复用已有消息:", messageId);
                  streamStateRef.current.content = existingMessage.content || "";
                  streamStateRef.current.toolCalls = existingMessage.toolCalls || [];
                  
                  agent.updateMessage(messageId, {
                    isStreaming: true,
                  });
                } else {
                  // 创建新消息（正常场景）
                  console.log("[Agent Stream] 创建新消息:", messageId);
                  streamStateRef.current.content = "";
                  streamStateRef.current.toolCalls = [];
                  
                  agent.addMessage({
                    id: messageId,
                    role: "assistant",
                    content: "",
                    isStreaming: true,
                  });
                  
                  // 触发首条 assistant 消息回调（只触发一次）
                  if (!firstAssistantMessageTriggeredRef.current && options.onFirstAssistantMessage) {
                    console.log("[Agent Stream] 触发首条 assistant 消息回调");
                    firstAssistantMessageTriggeredRef.current = true;
                    options.onFirstAssistantMessage();
                  }
                }
                break;
              }

              case "content_delta": {
                // 内容增量更新：累积到 ref，然后更新到 state
                const messageId = streamStateRef.current.messageId;
                if (!messageId) break;
                
                streamStateRef.current.content += event.data;
                agent.updateMessage(messageId, {
                  content: streamStateRef.current.content,
                });
                break;
              }

              case "tool_call_start": {
                // Tool 调用开始：添加到 ref 的 toolCalls 数组
                const messageId = streamStateRef.current.messageId;
                if (!messageId) break;
                
                console.log("[Agent Stream] Tool 调用开始:", event.data.name, "ID:", event.data.id);
                
                // 使用后端提供的真实 tool call ID 和参数
                const newToolCall = {
                  id: event.data.id,
                  type: "function" as const,
                  function: {
                    name: event.data.name,
                    arguments: event.data.arguments,
                  },
                };
                
                // 添加到 ref
                streamStateRef.current.toolCalls.push(newToolCall);
                
                // 更新到 state
                agent.updateMessage(messageId, {
                  toolCalls: [...streamStateRef.current.toolCalls],
                });
                break;
              }

              case "tool_call_end": {
                // Tool 调用结束：使用后端提供的 ID 查找对应的 tool call
                const messageId = streamStateRef.current.messageId;
                if (!messageId) break;
                
                console.log("[Agent Stream] Tool 调用结束:", event.data.name, event.data.success, "ID:", event.data.id);
                
                // 从 ref 中通过 ID 精确查找对应的 tool call
                const matchingToolCall = streamStateRef.current.toolCalls.find(
                  tc => tc.id === event.data.id
                );
                
                if (matchingToolCall) {
                  // 检查是否已存在此 tool call 的 tool message（客户端预测可能已创建）
                  const existingToolMessage = agent.state.messages.find(
                    m => m.role === "tool" && m.toolCallId === matchingToolCall.id
                  );
                  
                  if (existingToolMessage) {
                    console.log("[Agent Stream] Tool message 已存在（客户端预测），跳过创建");
                  } else {
                    // 创建对应的 tool message 并添加到状态中
                    const toolMessageId = `tool-${matchingToolCall.id}-${Date.now()}`;
                    agent.addMessage({
                      id: toolMessageId,
                      role: "tool",
                      content: JSON.stringify({
                        success: event.data.success,
                        data: event.data.result,
                        error: event.data.error,
                      }),
                      toolCallId: matchingToolCall.id, // 关联到具体的 tool call（使用真实 ID）
                    });
                  }
                  
                  // 🔥 通知外部 tool call 已完成
                  if (options.onToolCallEnd) {
                    options.onToolCallEnd(event.data.name, event.data.success);
                  }
                } else {
                  console.warn("[Agent Stream] 未找到匹配的 tool call:", event.data.name, "ID:", event.data.id);
                }
                break;
              }

              case "interrupt": {
                // 需要用户确认（前端会从消息历史推导 approval 信息）
                const messageId = streamStateRef.current.messageId;
                if (!messageId) break;
                
                // 标记消息流结束
                agent.updateMessage(messageId, {
                  isStreaming: false,
                });
                
                // 🆕 关键修复：等待用户确认时，停止显示"正在创作"
                agent.setLoading(false);
                
                // 触发回调
                options.onPendingAction?.();
                break;
              }

              case "complete": {
                // 完成
                const messageId = streamStateRef.current.messageId;
                if (messageId) {
                  agent.updateMessage(messageId, {
                    isStreaming: false,
                  });
                }
                
                // 🆕 兜底机制：确保 isLoading 被设置为 false
                agent.setLoading(false);
                
                options.onComplete?.();
                break;
              }

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
    } finally {
      // 清除超时
      clearTimeout(timeoutId);
      
      // Fallback: 确保 isStreaming 被设置为 false
      const messageId = streamStateRef.current.messageId;
      if (messageId) {
        // 这里需要从 state 查找，因为要检查 isStreaming 状态
        const currentMessage = agent.state.messages.find(m => m.id === messageId);
        if (currentMessage?.isStreaming) {
          console.log("[Agent Stream] Fallback: 流结束，设置 isStreaming = false");
          agent.updateMessage(messageId, {
            isStreaming: false,
          });
        }
      }
      
      // 清理 ref 状态
      streamStateRef.current = {
        messageId: null,
        content: "",
        toolCalls: [],
      };
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
    async (
      conversationId: string,
      approved: boolean,
      modifiedParams?: Record<string, unknown>,
      feedback?: string
    ) => {
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
              modifiedParams,
              feedback, // 用户反馈理由
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
