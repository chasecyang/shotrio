"use client";

import { memo } from "react";
import type { AgentMessage } from "@/types/agent";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Hand } from "lucide-react";
import { DisplayStepCard } from "./display-step-card";
import { useMessageDisplay } from "./use-message-display";
import { useAgent } from "./agent-context";

interface ChatMessageProps {
  message: AgentMessage;
}

import { useTranslations } from "next-intl";

// 中断标记组件
const InterruptedBadge = () => {
  const t = useTranslations("editor");
  return (
    <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 mt-2">
      <Hand className="h-3.5 w-3.5" />
      <span>{t("interrupted")}</span>
    </div>
  );
};

export const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const agent = useAgent();

  // 使用新的 useMessageDisplay hook 构建展示步骤
  const displays = useMessageDisplay(agent.state.messages);
  const currentDisplay = displays.find(d => d.messageId === message.id);

  return (
    <div className="w-full px-4 py-2">
      {isUser ? (
        /* User Message */
        <div className="space-y-1.5">
          {/* Timestamp - only for user messages */}
          <div className="flex items-center justify-end">
            <span className="text-xs text-muted-foreground">
              {new Date(message.timestamp).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="rounded-lg bg-accent/50 backdrop-blur-sm border border-border/50 px-3 py-2 break-words w-full">
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          </div>
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

          {/* Interrupted Badge */}
          {message.isInterrupted && <InterruptedBadge />}
        </div>
      )}
    </div>
  );
});

