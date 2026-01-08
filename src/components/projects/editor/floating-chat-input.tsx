"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useAgent } from "./agent-panel/agent-context";
import { Bot, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAwaitingApproval } from "@/lib/services/agent-engine/approval-utils";
import { useTranslations } from "next-intl";

interface FloatingChatInputProps {
  onExpand: () => void;
}

export function FloatingChatInput({ onExpand }: FloatingChatInputProps) {
  const agent = useAgent();
  const t = useTranslations("editor");

  // 检查是否有待批准的操作
  const hasPendingAction = useMemo(() => {
    const messages = agent.state.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      tool_calls: msg.toolCalls,
      tool_call_id: msg.toolCallId,
    }));
    return isAwaitingApproval(messages as any[]);
  }, [agent.state.messages]);

  // 检查是否有未读消息（简化：有消息且不在loading状态）
  const hasMessages = agent.state.messages.length > 0 && !agent.state.isNewConversation;

  return (
    <motion.button
      onClick={onExpand}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "relative h-14 w-14 rounded-full",
        "bg-primary text-primary-foreground",
        "shadow-lg hover:shadow-xl",
        "flex items-center justify-center",
        "transition-shadow duration-200"
      )}
      title={t("expandAgent")}
    >
      {/* Bot 图标 */}
      {agent.state.isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : (
        <Bot className="h-6 w-6" />
      )}

      {/* 待批准操作徽章（优先显示） */}
      {hasPendingAction && !agent.state.isLoading && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-sm">
          !
        </span>
      )}

      {/* 消息提示红点（无待批准操作时显示） */}
      {!hasPendingAction && hasMessages && !agent.state.isLoading && (
        <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500 shadow-sm" />
      )}
    </motion.button>
  );
}
