"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AgentChatSkeletonProps {
  position?: "left" | "right" | "bottom";
}

/**
 * Agent 对话窗口骨架屏
 * 用于初始化时显示，避免延迟出现
 */
export function AgentChatSkeleton({ position = "left" }: AgentChatSkeletonProps) {
  // 底部模式
  if (position === "bottom") {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 pointer-events-none">
        <div
          className={cn(
            "max-h-[400px]",
            "bg-card/98 backdrop-blur-xl border border-border/70 rounded-2xl shadow-2xl",
            "dark:border-border/90 dark:shadow-[0_8px_32px_oklch(0_0_0/0.5)]",
            "flex flex-col overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>

          {/* Messages area */}
          <div className="flex-1 p-4 space-y-3 min-h-[200px]">
            <div className="flex gap-2">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <Skeleton className="h-16 flex-1 rounded-lg" />
            </div>
          </div>

          {/* Input area */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Skeleton className="h-10 flex-1 rounded-lg" />
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 左右模式
  return (
    <div className="w-[380px] h-full">
      <div
        className={cn(
          "h-full",
          "bg-card/98 backdrop-blur-xl border border-border/70 rounded-2xl shadow-2xl",
          "dark:border-border/90 dark:shadow-[0_8px_32px_oklch(0_0_0/0.5)]",
          "flex flex-col overflow-hidden"
        )}
      >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      {/* Messages area */}
      <div className="flex-1 p-4 space-y-4 overflow-hidden">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="border-t p-3 shrink-0">
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </div>
      </div>
    </div>
  );
}
