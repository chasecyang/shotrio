"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { getErrorMessageKey } from "@/lib/utils/error-sanitizer";
import type { Job } from "@/types/job";
import { AlertCircle, RefreshCw } from "lucide-react";

interface AssetProgressOverlayProps {
  job?: Job;
  asset?: { runtimeStatus?: string; errorMessage?: string | null };
  className?: string;
}

/**
 * 素材生成进度/状态覆盖层
 * 显示进度百分比、进度条、动画效果和失败状态
 */
export function AssetProgressOverlay({ job, asset, className }: AssetProgressOverlayProps) {
  const t = useTranslations();

  // 失败状态
  if (asset?.runtimeStatus === "failed") {
    const rawError = asset.errorMessage || job?.errorMessage;
    const errorMessage = t(getErrorMessageKey(rawError));

    return (
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center",
          "bg-destructive/10 backdrop-blur-sm",
          "animate-in fade-in duration-300",
          className
        )}
        role="alert"
        aria-live="polite"
      >
        {/* 失败图标 */}
        <div className="relative z-10 flex flex-col items-center gap-2 p-4">
          <div className="relative">
            <div className="relative w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center border-2 border-destructive/30">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 max-w-[180px]">
            <span className="text-sm font-semibold text-destructive">{t("editor.assetProgress.generationFailed")}</span>
            <span className="text-xs text-muted-foreground text-center line-clamp-2">
              {errorMessage}
            </span>
          </div>
        </div>

        {/* 底部失败指示条 */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-destructive/50" />
      </div>
    );
  }

  // 如果没有 job 或者任务已完成/取消，不显示覆盖层
  if (!job || job.status === "completed" || job.status === "cancelled") {
    return null;
  }

  const progress = job.progress || 0;
  const message = job.progressMessage || t("editor.assetProgress.generating");
  const status = job.status;

  // 生成中状态
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center z-10",
        "bg-background/95 backdrop-blur-sm",
        "animate-in fade-in duration-300",
        className
      )}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={message}
    >
      {/* 波纹动画背景 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 animate-ripple-1 rounded-full bg-primary/15" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 animate-ripple-2 rounded-full bg-primary/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 animate-ripple-3 rounded-full bg-primary/5" />
      </div>

      {/* 脉动边框 */}
      <div className="absolute inset-0 border-2 border-primary/40 animate-pulse-border pointer-events-none" />

      {/* 主内容区域 */}
      <div className="relative z-20 flex flex-col items-center gap-4 px-4">
        {/* 环形进度指示器 */}
        <div className="relative w-20 h-20">
          {/* 背景圆环 */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-muted/30"
            />
            {/* 进度圆环 */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress / 100)}`}
              className="text-primary transition-all duration-500 ease-out drop-shadow-lg"
            />
          </svg>
          
          {/* 中心进度百分比 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-2xl font-bold text-primary tabular-nums drop-shadow-md">
              {Math.round(progress)}%
            </div>
          </div>
        </div>
        
        {/* 状态消息 */}
        <div className="flex flex-col items-center gap-1">
          <div className="text-sm font-semibold text-foreground">
            {status === "pending" ? t("editor.assetProgress.preparingGeneration") : t("editor.assetProgress.generatingStatus")}
          </div>
          <div className="text-xs text-muted-foreground text-center max-w-[180px] line-clamp-2 px-2">
            {message}
          </div>
        </div>
      </div>

      {/* 底部进度条 */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-muted/50 overflow-hidden z-20">
        <div
          className="h-full bg-gradient-to-r from-primary/90 via-primary to-primary/90 transition-all duration-500 ease-out relative"
          style={{ width: `${progress}%` }}
        >
          {/* 进度条上的闪光效果 */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
      </div>

      {/* 添加必要的 CSS 动画 */}
      <style jsx>{`
        @keyframes ripple-1 {
          0% {
            transform: scale(0.8);
            opacity: 0.6;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        
        @keyframes ripple-2 {
          0% {
            transform: scale(0.8);
            opacity: 0.4;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
        
        @keyframes ripple-3 {
          0% {
            transform: scale(0.8);
            opacity: 0.2;
          }
          100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }
        
        @keyframes pulse-border {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.01);
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.85;
          }
        }
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
        
        .animate-ripple-1 {
          animation: ripple-1 3s ease-out infinite;
        }
        
        .animate-ripple-2 {
          animation: ripple-2 3s ease-out infinite 1s;
        }
        
        .animate-ripple-3 {
          animation: ripple-3 3s ease-out infinite 2s;
        }
        
        .animate-pulse-border {
          animation: pulse-border 2s ease-in-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        
        .animate-shimmer {
          animation: shimmer 2s linear infinite;
        }
      `}</style>
    </div>
  );
}

