"use client";

import { memo, useState } from "react";
import type { AgentMessage, IterationStep } from "@/types/agent";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Hand } from "lucide-react";
import { IterationCard } from "./iteration-card";
import { PendingActionMessage } from "./pending-action-message";
import { useAgent } from "./agent-context";
import { confirmAndExecuteAction } from "@/lib/actions/agent";
import { toast } from "sonner";

// 辅助函数：更新迭代数组
function updateIterations(
  iterations: IterationStep[],
  index: number,
  updates: Partial<IterationStep>
): IterationStep[] {
  return iterations.map((iter, i) =>
    i === index ? { ...iter, ...updates } : iter
  );
}

interface ChatMessageProps {
  message: AgentMessage;
  currentBalance?: number;
}

// 中断标记组件
const InterruptedBadge = () => (
  <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 mt-2">
    <Hand className="h-3.5 w-3.5" />
    <span>已中断</span>
  </div>
);

export const ChatMessage = memo(function ChatMessage({ message, currentBalance }: ChatMessageProps) {
  const isUser = message.role === "user";
  const agent = useAgent();

  // Handle pending action confirmation
  const handleConfirmAction = async () => {
    if (!message.pendingAction || !agent.state.currentConversationId) return;

    try {
      const result = await confirmAndExecuteAction({
        conversationId: agent.state.currentConversationId,
        messageId: message.id,
        functionCalls: message.pendingAction.functionCalls,
      });
      
      if (result.success) {
        toast.success("操作已确认，正在执行...");
        // Update pendingAction status to accepted (keep the action in history)
        agent.updateMessage(message.id, { 
          pendingAction: { ...message.pendingAction, status: "accepted" }
        });
        // Refresh conversations to update status
        agent.refreshConversations();
      } else {
        toast.error(result.error || "确认失败");
      }
    } catch (error) {
      console.error("确认操作失败:", error);
      toast.error("确认操作失败");
    }
  };

  const [isRejecting, setIsRejecting] = useState(false);

  const handleCancelAction = async () => {
    if (!message.pendingAction || !agent.state.currentConversationId || isRejecting) return;

    setIsRejecting(true);
    
    try {
      // 1. 调用服务端 action 标记为已拒绝
      const result = await agent.rejectAction(message.id);
      
      if (!result.success) {
        toast.error(result.error || "拒绝失败");
        setIsRejecting(false);
        return;
      }

      toast.info("操作已拒绝，Agent 正在提供替代方案...");

      // 2. 更新本地消息状态（移除 pending action UI）
      agent.updateMessage(message.id, { 
        pendingAction: { ...message.pendingAction, status: "rejected" }
      });

      // 3. 创建新的 assistant 消息用于流式输出
      const tempMsgId = agent.addMessage({
        role: "assistant",
        content: "",
        isStreaming: true,
        iterations: [],
      });

      // 4. 调用 resume-stream API（带拒绝标记）
      const response = await fetch("/api/agent/resume-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: agent.state.currentConversationId,
          messageId: message.id,
          isRejection: true,
          rejectionReason: "用户拒绝了此操作",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法读取响应流");
      }

      // 5. 处理流式响应
      await processResumeStream(reader, tempMsgId);

      // 6. 刷新对话列表
      agent.refreshConversations();
    } catch (error) {
      console.error("拒绝操作失败:", error);
      toast.error("拒绝操作失败");
    } finally {
      setIsRejecting(false);
    }
  };

  // 处理 resume 流式响应
  const processResumeStream = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    tempMsgId: string
  ) => {
    const decoder = new TextDecoder();
    let iterations: IterationStep[] = [];
    let currentIterationIndex = -1;
    let buffer = "";

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
              case "iteration_start":
                iterations = [...iterations, {
                  id: `iter-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                  iterationNumber: event.data.iterationNumber,
                  timestamp: new Date(),
                }];
                currentIterationIndex = iterations.length - 1;
                agent.updateMessage(tempMsgId, { iterations, isStreaming: true });
                break;

              case "thinking":
                if (currentIterationIndex >= 0) {
                  iterations = updateIterations(iterations, currentIterationIndex, {
                    thinkingProcess: event.data.content,
                  });
                  agent.updateMessage(tempMsgId, { iterations, isStreaming: true });
                }
                break;

              case "content":
                if (currentIterationIndex >= 0) {
                  iterations = updateIterations(iterations, currentIterationIndex, {
                    content: event.data.content,
                  });
                  agent.updateMessage(tempMsgId, { iterations, isStreaming: true });
                }
                break;

              case "pending_action":
                // 新的待确认操作
                const pendingAction = event.data;
                agent.updateMessage(tempMsgId, {
                  pendingAction: {
                    id: pendingAction.id,
                    functionCalls: [pendingAction.functionCall],
                    message: pendingAction.message,
                    conversationState: pendingAction.conversationState,
                    createdAt: new Date(),
                    creditCost: pendingAction.creditCost,
                    status: "pending",
                  },
                  isStreaming: false,
                  iterations,
                });
                break;

              case "complete":
                agent.updateMessage(tempMsgId, {
                  isStreaming: false,
                  iterations,
                });
                break;

              case "error":
                toast.error(event.data || "执行出错");
                agent.updateMessage(tempMsgId, {
                  content: `错误：${event.data}`,
                  isStreaming: false,
                });
                break;
            }
          } catch (parseError) {
            console.error("解析事件失败:", parseError);
          }
        }
      }
    } catch (streamError) {
      console.error("流式处理失败:", streamError);
      agent.updateMessage(tempMsgId, {
        content: `抱歉，出错了：${streamError instanceof Error ? streamError.message : "未知错误"}`,
        isStreaming: false,
      });
      throw streamError;
    }
  };


  // Check if this message uses the new iterations format
  const hasIterations = message.iterations && message.iterations.length > 0;
  const hasPendingAction = message.pendingAction !== undefined;

  return (
    <div className="w-full px-4 py-2">
      {/* Timestamp */}
      <div className="flex items-center justify-end mb-1.5">
        <span className="text-xs text-muted-foreground">
          {new Date(message.timestamp).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {isUser ? (
        /* User Message */
        <div className="rounded-lg bg-accent/50 backdrop-blur-sm border border-border/50 px-3 py-2 break-words w-full">
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      ) : (
        /* AI Message */
        <div className="space-y-3">
          {/* Iterations Timeline (思考过程) */}
          {hasIterations && (
            <div className="space-y-3">
              {message.iterations!.map((iteration, index) => (
                <IterationCard
                  key={iteration.id}
                  iteration={iteration}
                  isStreaming={message.isStreaming}
                  isLastIteration={index === message.iterations!.length - 1}
                />
              ))}
            </div>
          )}

          {/* Simple content (for responses without iterations) */}
          {!hasIterations && message.content && (
            <div className="text-sm break-words">
              <MarkdownRenderer content={message.content} className="inline" />
              {message.isStreaming && (
                <span className="inline-block w-1 h-4 ml-0.5 bg-current animate-pulse align-middle" />
              )}
            </div>
          )}

          {/* Pending Action (待确认操作) */}
          {hasPendingAction && (
            <PendingActionMessage
              action={message.pendingAction!}
              onConfirm={handleConfirmAction}
              onCancel={handleCancelAction}
              currentBalance={currentBalance}
            />
          )}

          {/* Interrupted Badge */}
          {message.isInterrupted && <InterruptedBadge />}
        </div>
      )}
    </div>
  );
});

