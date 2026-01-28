"use client";

import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import type { DisplayStep, ToolCallStatus } from "./use-message-display";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { CheckCircle2, XCircle, Loader2, Clock, Ban, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// 提取的状态图标函数
const getStatusIcon = (status: ToolCallStatus, size: "sm" | "md" = "md") => {
  const sizeClass = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  switch (status) {
    case "completed":
      return <CheckCircle2 className={cn(sizeClass, "text-green-600 shrink-0")} />;
    case "failed":
      return <XCircle className={cn(sizeClass, "text-red-600 shrink-0")} />;
    case "rejected":
      return <Ban className={cn(sizeClass, "text-gray-600 shrink-0")} />;
    case "executing":
      return size === "md" ? (
        <div className="relative inline-flex items-center justify-center">
          <Loader2 className={cn(sizeClass, "animate-spin text-blue-600 shrink-0 drop-shadow-[0_0_3px_rgba(37,99,235,0.4)]")} />
        </div>
      ) : (
        <Loader2 className={cn(sizeClass, "animate-spin text-blue-600 shrink-0")} />
      );
    case "awaiting_confirmation":
      return <Clock className={cn(sizeClass, "text-orange-600 shrink-0")} />;
    default:
      return null;
  }
};

// 提取的状态样式函数
const getStatusClassName = (status: ToolCallStatus) => {
  switch (status) {
    case "completed":
      return "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/40 dark:border-green-800/80 dark:text-green-400";
    case "failed":
      return "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800/80 dark:text-red-400";
    case "rejected":
      return "bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-950/40 dark:border-gray-800/80 dark:text-gray-400";
    case "executing":
      return "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800/80 dark:text-blue-400";
    case "awaiting_confirmation":
      return "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/40 dark:border-orange-800/80 dark:text-orange-400";
    default:
      return "";
  }
};

interface DisplayStepCardProps {
  step: DisplayStep;
  isStreaming?: boolean;
}

export const DisplayStepCard = memo(function DisplayStepCard({
  step,
  isStreaming,
}: DisplayStepCardProps) {
  const t = useTranslations("editor.agent.toolExecution");
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);

  if (step.type === "reasoning") {
    // 思考过程（Gemini reasoning）- 可折叠
    return (
      <div className="text-sm">
        <button
          onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isStreaming && !step.isComplete && (
            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          )}
          <span>{t("reasoning.title")}</span>
          {isReasoningExpanded ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
        </button>
        {isReasoningExpanded && (
          <div className="mt-2 pl-4 border-l border-border text-muted-foreground">
            <MarkdownRenderer content={step.content || ""} className="text-xs" />
          </div>
        )}
      </div>
    );
  }

  if (step.type === "thinking") {
    // 思考内容
    return (
      <div className="text-sm break-words text-foreground">
        <MarkdownRenderer content={step.content || ""} className="inline" />
      </div>
    );
  }

  if (step.type === "tool_call" && step.toolCall) {
    // 单个 Tool 调用
    const { toolCall } = step;

    const getStatusText = (tc: { status: ToolCallStatus; result?: string; error?: string }) => {
      switch (tc.status) {
        case "completed":
          return tc.result || t("status.completed");
        case "failed": {
          const errorText = tc.error === "PARSE_RESPONSE_FAILED"
            ? t("status.parseResponseFailed")
            : tc.error;
          return errorText ? t("status.failedWithError", { error: errorText }) : t("status.failed");
        }
        case "rejected":
          return t("status.rejected");
        case "executing":
          return t("status.executing");
        case "awaiting_confirmation":
          return t("status.awaitingConfirmation");
        default:
          return "";
      }
    };

    const displayText = toolCall.displayName || toolCall.name;
    const statusText = getStatusText(toolCall);
    const showStatusText = statusText && toolCall.status !== "awaiting_confirmation";

    return (
      <div
        className={cn(
          "flex items-center gap-2 text-xs px-2 py-1.5 rounded-md border",
          getStatusClassName(toolCall.status)
        )}
      >
        {getStatusIcon(toolCall.status)}
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

  // 多个 Tool 调用（批量模式）
  if (step.type === "tool_call" && step.toolCalls && step.toolCalls.length > 0) {
    // 统计各状态数量
    const awaitingCount = step.toolCalls.filter(tc => tc.status === "awaiting_confirmation").length;
    const completedCount = step.toolCalls.filter(tc => tc.status === "completed").length;
    const failedCount = step.toolCalls.filter(tc => tc.status === "failed").length;

    // 确定整体状态
    const overallStatus: ToolCallStatus = awaitingCount > 0
      ? "awaiting_confirmation"
      : failedCount > 0
        ? "failed"
        : completedCount === step.toolCalls.length
          ? "completed"
          : "executing";

    // 获取显示名称（使用第一个 tool call 的名称）
    const displayName = step.toolCalls[0].displayName || step.toolCalls[0].name;

    return (
      <div className="space-y-1.5">
        {/* 批量操作头部 */}
        <div
          className={cn(
            "flex items-center gap-2 text-xs px-2 py-1.5 rounded-md border",
            getStatusClassName(overallStatus)
          )}
        >
          {getStatusIcon(overallStatus)}
          <span className="font-medium shrink-0">
            {displayName}
          </span>
          <span className="text-muted-foreground/60 shrink-0">·</span>
          <span className="text-[10px] opacity-75">
            {t("batch.count", { count: step.toolCalls.length })}
          </span>
        </div>

        {/* 各操作详情列表（仅在非等待确认状态时显示） */}
        {overallStatus !== "awaiting_confirmation" && (
          <div className="pl-4 space-y-1">
            {step.toolCalls.map((tc) => {
              // 解析参数获取标题
              let title = "";
              try {
                const args = JSON.parse(tc.arguments);
                title = args.title || args.name || "";
              } catch {
                // ignore
              }

              return (
                <div
                  key={tc.id}
                  className={cn(
                    "flex items-center gap-1.5 text-[10px] px-1.5 py-1 rounded border",
                    getStatusClassName(tc.status)
                  )}
                >
                  {getStatusIcon(tc.status, "sm")}
                  <span className="truncate">
                    {title || tc.displayName || tc.name}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return null;
});

