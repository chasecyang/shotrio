"use client";

import { memo, useState, useEffect } from "react";
import type { AgentMessage } from "@/types/agent";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Hand } from "lucide-react";
import { IterationCard } from "./iteration-card";
import { PendingActionMessage } from "./pending-action-message";
import { useAgent } from "./agent-context";
import { confirmAndExecuteAction, cancelAction } from "@/lib/actions/agent";
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
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [hasAutoCollapsed, setHasAutoCollapsed] = useState(false);

  // Handle pending action confirmation
  const handleConfirmAction = async (actionId: string) => {
    try {
      const result = await confirmAndExecuteAction(actionId, agent.currentContext);
      if (result.success) {
        toast.success("操作已确认，正在执行...");
        // Update pendingAction status to accepted (keep the action in history)
        if (message.pendingAction) {
          agent.updateMessage(message.id, { 
            pendingAction: { ...message.pendingAction, status: "accepted" }
          });
        }
      } else {
        toast.error(result.error || "确认失败");
      }
    } catch (error) {
      console.error("确认操作失败:", error);
      toast.error("确认操作失败");
    }
  };

  const handleCancelAction = async (actionId: string) => {
    try {
      const result = await cancelAction(actionId);
      if (result.success) {
        toast.info("操作已取消");
        // Update pendingAction status to rejected (keep the action in history)
        if (message.pendingAction) {
          agent.updateMessage(message.id, { 
            pendingAction: { ...message.pendingAction, status: "rejected" }
          });
        }
      } else {
        toast.error(result.error || "取消失败");
      }
    } catch (error) {
      console.error("取消操作失败:", error);
      toast.error("取消操作失败");
    }
  };

  // Auto-expand thinking process when streaming, auto-collapse when done (for backward compatibility)
  useEffect(() => {
    if (message.thinkingProcess && message.isStreaming && !hasAutoCollapsed) {
      setIsThinkingExpanded(true);
    } else if (message.thinkingProcess && !message.isStreaming && !hasAutoCollapsed) {
      // Auto-collapse when streaming completes
      setIsThinkingExpanded(false);
      setHasAutoCollapsed(true);
    }
  }, [message.thinkingProcess, message.isStreaming, hasAutoCollapsed]);

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
        <>
          {/* Thinking Process - 保留用于向后兼容，但新的流式消息都使用 iterations */}
          {message.thinkingProcess && (
            <Collapsible
              className="w-full mb-2"
              open={isThinkingExpanded}
              onOpenChange={setIsThinkingExpanded}
            >
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    isThinkingExpanded && "rotate-180"
                  )}
                />
                <span>思考过程</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1.5 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground max-h-60 overflow-y-auto break-words">
                  <p className="whitespace-pre-wrap">
                    {message.thinkingProcess}
                    {message.isStreaming && (
                      <span className="inline-block w-1 h-3 ml-0.5 bg-current animate-pulse align-middle" />
                    )}
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Main Content */}
          <div className="text-sm break-words">
            <MarkdownRenderer content={message.content} className="inline" />
            {message.isStreaming && message.content && (
              <span className="inline-block w-1 h-4 ml-0.5 bg-current animate-pulse align-middle" />
            )}
            {message.isInterrupted && <InterruptedBadge />}
          </div>
        </>
      )}
    </div>
  );
});

