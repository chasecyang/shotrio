"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AssetSkeletonProps {
  count?: number;
}

/**
 * 单个素材骨架屏
 */
export function AssetCardSkeleton() {
  return (
    <div className="rounded-lg border overflow-hidden">
      {/* 缩略图骨架 */}
      <Skeleton className="aspect-video w-full" />
      
      {/* 信息区域骨架 */}
      <div className="p-3 space-y-1.5">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * 素材网格骨架屏
 */
export function AssetListSkeleton({ count = 6 }: AssetSkeletonProps) {
  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))"
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <AssetCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * 素材缩略图骨架屏（用于生成中状态）
 */
export function AssetThumbnailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 bg-muted/30 flex flex-col items-center justify-center gap-2", className)}>
      <Skeleton className="w-8 h-8 rounded-full" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

/**
 * 小型素材预览骨架屏（用于Agent面板等）
 */
export function AssetPreviewSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-md overflow-hidden border border-border/50 bg-background/50">
          <Skeleton className="w-16 h-16" />
        </div>
      ))}
    </div>
  );
}

