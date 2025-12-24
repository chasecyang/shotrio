"use client";

import { memo } from "react";
import type { IterationStep } from "@/types/agent";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FunctionCallCardProps {
  functionCall: NonNullable<IterationStep["functionCall"]>;
}

export const FunctionCallCard = memo(function FunctionCallCard({
  functionCall,
}: FunctionCallCardProps) {
  const getStatusIcon = () => {
    switch (functionCall.status) {
      case "completed":
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />;
      case "failed":
        return <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />;
      case "executing":
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 shrink-0" />;
      case "pending":
        return <Loader2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (functionCall.status) {
      case "completed":
        return functionCall.result || "完成";
      case "failed":
        return functionCall.error ? `失败：${functionCall.error}` : "失败";
      case "executing":
        return "执行中...";
      case "pending":
        return "等待中...";
      default:
        return "";
    }
  };

  const displayText = functionCall.displayName || functionCall.description || functionCall.name;
  const statusText = getStatusText();
  const showStatusText = (functionCall.status === "completed" || functionCall.status === "failed" || functionCall.status === "executing") && statusText;

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs px-2 py-1.5 rounded-md border",
        functionCall.status === "completed" && "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-900 dark:text-green-400",
        functionCall.status === "failed" && "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400",
        functionCall.status === "executing" && "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-400",
        functionCall.status === "pending" && "bg-muted border-border text-muted-foreground"
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
      {functionCall.status === "failed" && functionCall.error && !showStatusText && (
        <>
          <span className="text-muted-foreground/60 shrink-0">·</span>
          <span className="text-[10px] opacity-70 shrink-0 min-w-0 truncate">
            {functionCall.error}
          </span>
        </>
      )}
    </div>
  );
});

