"use client";

import { cn } from "@/lib/utils";
import type { Job } from "@/types/job";
import { AlertCircle, RefreshCw } from "lucide-react";

interface AssetProgressOverlayProps {
  job?: Job;
  asset?: { status: string; errorMessage?: string | null };
  className?: string;
}

/**
 * 素材生成进度/状态覆盖层
 * 显示进度百分比、进度条、动画效果和失败状态
 */
export function AssetProgressOverlay({ job, asset, className }: AssetProgressOverlayProps) {
  // 失败状态
  if (asset?.status === "failed") {
    const errorMessage = asset.errorMessage || job?.errorMessage || "生成失败，请重试";
    
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
            {/* 脉动红色圆环 */}
            <div className="absolute inset-0 rounded-full bg-destructive/20 animate-ping" />
            <div className="relative w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center border-2 border-destructive/30">
              <AlertCircle className="w-8 h-8 text-destructive animate-pulse" />
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-1 max-w-[180px]">
            <span className="text-sm font-semibold text-destructive">生成失败</span>
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
  const message = job.progressMessage || "生成中...";
  const status = job.status;

  // 生成中状态
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center",
        "bg-background/80 backdrop-blur-md",
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
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 animate-ripple-1 rounded-full bg-primary/10" />
        <div className="absolute inset-0 animate-ripple-2 rounded-full bg-primary/10" />
        <div className="absolute inset-0 animate-ripple-3 rounded-full bg-primary/10" />
      </div>

      {/* 脉动边框 */}
      <div className="absolute inset-0 rounded-lg border-2 border-primary/30 animate-pulse-border" />

      {/* 主内容区域 */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        {/* 进度百分比 */}
        <div className="flex flex-col items-center gap-1">
          <div className="text-4xl font-bold text-primary tabular-nums animate-pulse-slow">
            {Math.round(progress)}%
          </div>
          
          {/* 状态消息 */}
          <div className="text-xs text-muted-foreground text-center max-w-[150px] truncate">
            {message}
          </div>
        </div>

        {/* 环形进度指示器（装饰性） */}
        <div className="relative w-16 h-16">
          {/* 背景圆环 */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted/20"
            />
            {/* 进度圆环 */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
              className="text-primary transition-all duration-300 ease-out"
            />
          </svg>
          
          {/* 中心旋转点 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-primary animate-ping" />
          </div>
        </div>
      </div>

      {/* 底部进度条 */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/30 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        >
          {/* 进度条上的闪光效果 */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
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

