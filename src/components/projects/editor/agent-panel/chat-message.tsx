"use client";

import { memo } from "react";
import type { AgentMessage } from "@/types/agent";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Hand } from "lucide-react";
import { IterationCard } from "./iteration-card";
import { PendingActionMessage } from "./pending-action-message";
import { useAgent } from "./agent-context";
import { confirmAndExecuteAction } from "@/lib/actions/agent";
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

  const handleCancelAction = async () => {
    // No server call needed, just update local state
    toast.info("操作已取消");
    if (message.pendingAction) {
      agent.updateMessage(message.id, { 
        pendingAction: { ...message.pendingAction, status: "rejected" }
      });
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

      {hasPendingAction ? (
        /* Pending Action Message */
        <PendingActionMessage
          action={message.pendingAction!}
          onConfirm={handleConfirmAction}
          onCancel={handleCancelAction}
          currentBalance={currentBalance}
        />
      ) : isUser ? (
        /* User Message */
        <div className="rounded-lg bg-accent/50 backdrop-blur-sm border border-border/50 px-3 py-2 break-words w-full">
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      ) : hasIterations ? (
        /* AI Message with Iterations Timeline */
        <div className="space-y-3">
          {message.iterations!.map((iteration, index) => (
            <IterationCard
              key={iteration.id}
              iteration={iteration}
              isStreaming={message.isStreaming}
              isLastIteration={index === message.iterations!.length - 1}
            />
          ))}
          {message.isInterrupted && <InterruptedBadge />}
        </div>
      ) : (
        /* AI Message - Simple Format (for simple text responses without iterations) */
        <div className="text-sm break-words">
          <MarkdownRenderer content={message.content} className="inline" />
          {message.isStreaming && message.content && (
            <span className="inline-block w-1 h-4 ml-0.5 bg-current animate-pulse align-middle" />
          )}
          {message.isInterrupted && <InterruptedBadge />}
        </div>
      )}
    </div>
  );
});

