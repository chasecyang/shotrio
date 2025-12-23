"use client";

import { memo, useState } from "react";
import type { AgentMessage } from "@/types/agent";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Hand } from "lucide-react";
import { IterationCard } from "./iteration-card";
import { PendingActionMessage } from "./pending-action-message";
import { useAgent } from "./agent-context";
import { useLangGraphStream } from "./use-langgraph-stream";
import { getConversation } from "@/lib/actions/conversation/crud";
import { toast } from "sonner";

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

  const [isConfirming, setIsConfirming] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  
  // 使用 LangGraph Stream Hook
  const { resumeConversation } = useLangGraphStream({
    onComplete: () => {
      // 刷新对话列表
      setTimeout(() => {
        agent.refreshConversations();
      }, 100);
    },
    onError: (error) => {
      console.error("LangGraph Stream 错误:", error);
      toast.error("操作失败");
    },
  });

  // Handle pending action confirmation
  const handleConfirmAction = async () => {
    if (!message.pendingAction || !agent.state.currentConversationId || isConfirming) return;

    setIsConfirming(true);

    try {
      // 1. 获取对话的 threadId
      const convResult = await getConversation(agent.state.currentConversationId);
      if (!convResult.success || !convResult.conversation?.threadId) {
        toast.error("无法获取对话信息");
        setIsConfirming(false);
        return;
      }

      const threadId = convResult.conversation.threadId;

      toast.success("操作已确认，Agent 正在继续...");

      // 2. 恢复对话，LangGraph 会自动执行已确认的 function calls
      await resumeConversation(threadId, true);
    } catch (error) {
      console.error("确认操作失败:", error);
      toast.error("确认操作失败");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancelAction = async () => {
    if (!message.pendingAction || !agent.state.currentConversationId || isRejecting) return;

    setIsRejecting(true);
    
    try {
      // 1. 获取对话的 threadId
      const convResult = await getConversation(agent.state.currentConversationId);
      if (!convResult.success || !convResult.conversation?.threadId) {
        toast.error("无法获取对话信息");
        setIsRejecting(false);
        return;
      }

      const threadId = convResult.conversation.threadId;

      toast.info("操作已拒绝，Agent 正在提供替代方案...");

      // 2. 使用 hook 恢复对话（approved: false）
      await resumeConversation(threadId, false, "用户拒绝了此操作");
    } catch (error) {
      console.error("拒绝操作失败:", error);
      toast.error("拒绝操作失败");
    } finally {
      setIsRejecting(false);
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

