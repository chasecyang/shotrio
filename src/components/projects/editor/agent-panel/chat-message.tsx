"use client";

import { memo, useState } from "react";
import type { AgentMessage, IterationStep } from "@/types/agent";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Hand } from "lucide-react";
import { IterationCard } from "./iteration-card";
import { PendingActionMessage } from "./pending-action-message";
import { useAgent } from "./agent-context";
import { useAgentStream } from "./use-agent-stream";
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
  
  // 判断是否为分镜相关操作
  const isShotRelatedAction = message.pendingAction?.functionCall?.name && 
    ['create_shot', 'update_shot', 'delete_shots', 'reorder_shots'].includes(
      message.pendingAction.functionCall.name
    );

  // 使用 Agent Stream Hook
  const { resumeConversation } = useAgentStream({
    onIterationUpdate: (iterations: IterationStep[]) => {
      // 检查是否有分镜相关操作完成
      const lastIteration = iterations[iterations.length - 1];
      if (lastIteration?.functionCall?.status === "completed" && 
          lastIteration.functionCall.name &&
          ['create_shot', 'update_shot', 'delete_shots', 'reorder_shots'].includes(
            lastIteration.functionCall.name
          )) {
        // 延迟触发刷新，确保数据库操作已完成
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("shots-changed"));
        }, 200);
      }
    },
    onComplete: () => {
      // 设置 loading 状态为 false（由 context 统一管理）
      agent.setLoading(false);
      
      // 如果是分镜相关操作，刷新时间轴
      if (isShotRelatedAction) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("shots-changed"));
        }, 300);
      }
      
      // 刷新对话列表（静默刷新，不显示全屏loading）
      setTimeout(() => {
        agent.refreshConversations(true);
      }, 100);
    },
    onError: (error) => {
      // 设置 loading 状态为 false（由 context 统一管理）
      agent.setLoading(false);
      console.error("Agent Stream 错误:", error);
      toast.error("操作失败");
    },
  });

  // Handle pending action confirmation
  const handleConfirmAction = async () => {
    if (!message.pendingAction || !agent.state.currentConversationId || isConfirming) return;

    setIsConfirming(true);

    try {
      console.log("[Agent] 准备确认，conversationId:", agent.state.currentConversationId);

      toast.success("操作已确认，Agent 正在继续...");

      // 设置 loading 状态
      agent.setLoading(true);

      // 恢复对话，Engine 会自动执行已确认的操作
      // pendingAction 的清除由后端通过 state_update 事件管理
      await resumeConversation(agent.state.currentConversationId, true);
    } catch (error) {
      console.error("确认操作失败:", error);
      toast.error("确认操作失败");
      // 出错时清除 loading 状态
      agent.setLoading(false);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancelAction = async () => {
    if (!message.pendingAction || !agent.state.currentConversationId || isRejecting) return;

    setIsRejecting(true);
    
    try {
      console.log("[Agent] 准备拒绝，conversationId:", agent.state.currentConversationId);

      toast.info("操作已拒绝，Agent 正在提供替代方案...");

      // 设置 loading 状态
      agent.setLoading(true);

      // 恢复对话（拒绝操作）
      // pendingAction 的清除由后端通过 state_update 事件管理
      await resumeConversation(agent.state.currentConversationId, false, "用户拒绝了此操作");
    } catch (error) {
      console.error("拒绝操作失败:", error);
      toast.error("拒绝操作失败");
      // 出错时清除 loading 状态
      agent.setLoading(false);
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

