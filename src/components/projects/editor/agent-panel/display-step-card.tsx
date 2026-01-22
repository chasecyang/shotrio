"use client";

import { memo } from "react";
import type { DisplayStep } from "./use-message-display";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { CheckCircle2, XCircle, Loader2, Clock, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisplayStepCardProps {
  step: DisplayStep;
  isStreaming?: boolean;
}

export const DisplayStepCard = memo(function DisplayStepCard({
  step,
  isStreaming,
}: DisplayStepCardProps) {
  if (step.type === "thinking") {
    // 思考内容
    return (
      <div className="text-sm break-words text-foreground">
        <MarkdownRenderer content={step.content || ""} className="inline" />
      </div>
    );
  }

  if (step.type === "tool_call" && step.toolCall) {
    // Tool 调用
    const { toolCall } = step;
    
    const getStatusIcon = () => {
      switch (toolCall.status) {
        case "completed":
          return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />;
        case "failed":
          return <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />;
        case "rejected":
          return <Ban className="h-3.5 w-3.5 text-gray-600 shrink-0" />;
        case "executing":
          return (
            <div className="relative inline-flex items-center justify-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 shrink-0 drop-shadow-[0_0_3px_rgba(37,99,235,0.4)]" />
            </div>
          );
        case "awaiting_confirmation":
          return <Clock className="h-3.5 w-3.5 text-orange-600 shrink-0" />;
        default:
          return null;
      }
    };

    const getStatusText = () => {
      switch (toolCall.status) {
        case "completed":
          return toolCall.result || "完成";
        case "failed":
          return toolCall.error ? `失败：${toolCall.error}` : "失败";
        case "rejected":
          return toolCall.error || "用户拒绝了此操作";
        case "executing":
          return "执行中...";
        case "awaiting_confirmation":
          return "等待用户确认";
        default:
          return "";
      }
    };

    const displayText = toolCall.displayName || toolCall.name;
    const statusText = getStatusText();
    const showStatusText = (toolCall.status === "completed" || toolCall.status === "failed" || toolCall.status === "rejected" || toolCall.status === "executing" || toolCall.status === "awaiting_confirmation") && statusText;

    return (
      <div
        className={cn(
          "flex items-center gap-2 text-xs px-2 py-1.5 rounded-md border",
          toolCall.status === "completed" && "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/40 dark:border-green-800/80 dark:text-green-400",
          toolCall.status === "failed" && "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800/80 dark:text-red-400",
          toolCall.status === "rejected" && "bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-950/40 dark:border-gray-800/80 dark:text-gray-400",
          toolCall.status === "executing" && "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800/80 dark:text-blue-400",
          toolCall.status === "awaiting_confirmation" && "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/40 dark:border-orange-800/80 dark:text-orange-400"
        )}
      >
        {getStatusIcon()}
        <span className="font-medium shrink-0">
          {displayText}
        </span>
        {showStatusText && (
          <>
            <span className="text-muted-foreground/60 shrink-0">·</span>
            <span className="text-[10px] opacity-75 flex-1 min-w-0 break-words">
              {statusText}
            </span>
          </>
        )}
      </div>
    );
  }

  return null;
});

