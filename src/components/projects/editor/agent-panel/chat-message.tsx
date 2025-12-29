"use client";

import { memo, useState } from "react";
import type { AgentMessage } from "@/types/agent";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Hand } from "lucide-react";
import { DisplayStepCard } from "./display-step-card";
import { useMessageDisplay } from "./use-message-display";
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
    ['create_shots', 'update_shots', 'delete_shots'].includes(
      message.pendingAction.functionCall.name
    );

  // 判断是否为项目/剧集相关操作
  const isProjectRelatedAction = message.pendingAction?.functionCall?.name && 
    ['update_episode', 'set_art_style'].includes(
      message.pendingAction.functionCall.name
    );

  // 使用 Agent Stream Hook（仅用于恢复对话）
  const { resumeConversation } = useAgentStream();

  // Handle pending action confirmation
  const handleConfirmAction = async () => {
    if (!message.pendingAction || !agent.state.currentConversationId || isConfirming) return;

    setIsConfirming(true);

    try {
      console.log("[Agent] 准备确认，conversationId:", agent.state.currentConversationId);

      // 立即清除 pendingAction，不等后端事件
      agent.updateMessage(message.id, {
        pendingAction: undefined,
      });

      toast.success("操作已确认，Agent 正在继续...");

      // 设置 loading 状态
      agent.setLoading(true);

      // 恢复对话，Engine 会自动执行已确认的操作
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
      console.log("[Agent] 用户拒绝操作");

      const toolCallId = message.pendingAction.functionCall.id;

      // 立即创建拒绝的 tool message（客户端预测，避免显示"执行中"状态）
      agent.addMessage({
        id: `tool-${toolCallId}-${Date.now()}`,
        role: "tool",
        content: JSON.stringify({
          success: false,
          error: "用户拒绝了此操作",
          userRejected: true,
        }),
        toolCallId: toolCallId,
      });

      // 清除 pendingAction，让确认卡片消失
      agent.updateMessage(message.id, {
        pendingAction: undefined,
      });

      toast.info("操作已拒绝，Agent 正在回应...");

      // 设置 loading 状态
      agent.setLoading(true);

      // 纯粹拒绝，不传 reason
      await resumeConversation(agent.state.currentConversationId, false);
    } catch (error) {
      console.error("拒绝操作失败:", error);
      toast.error("拒绝操作失败");
      // 出错时清除 loading 状态
      agent.setLoading(false);
    } finally {
      setIsRejecting(false);
    }
  };


  // 使用新的 useMessageDisplay hook 构建展示步骤
  const displays = useMessageDisplay(agent.state.messages);
  const currentDisplay = displays.find(d => d.messageId === message.id);
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
          {/* Display Steps (思考过程和工具调用) */}
          {currentDisplay && currentDisplay.steps.length > 0 && (
            <div className="space-y-3">
              {currentDisplay.steps.map(step => (
                <DisplayStepCard
                  key={step.id}
                  step={step}
                  isStreaming={message.isStreaming}
                />
              ))}
            </div>
          )}

          {/* Simple content (for responses without any steps) */}
          {!currentDisplay && message.content && (
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

