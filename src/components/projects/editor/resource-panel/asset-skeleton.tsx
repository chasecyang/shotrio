"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AssetSkeletonProps {
  viewMode?: "grid" | "list";
  count?: number;
}

/**
 * 单个素材骨架屏（网格视图）
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
 * 单个素材骨架屏（列表视图）
 */
export function AssetListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg border">
      {/* 缩略图骨架 */}
      <Skeleton className="w-12 h-12 rounded-md shrink-0" />
      
      {/* 信息骨架 */}
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-1.5">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * 素材列表骨架屏（完整页面）
 */
export function AssetListSkeleton({ viewMode = "grid", count = 6 }: AssetSkeletonProps) {
  return (
    <div
      className={cn(
        viewMode === "grid"
          ? "grid gap-3"
          : "flex flex-col gap-2"
      )}
      style={{
        gridTemplateColumns: viewMode === "grid" 
          ? "repeat(auto-fill, minmax(180px, 1fr))" 
          : undefined
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        viewMode === "grid" ? (
          <AssetCardSkeleton key={i} />
        ) : (
          <AssetListItemSkeleton key={i} />
        )
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

/**
 * Shot素材选择器骨架屏
 */
export function ShotAssetSelectorSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-square rounded-lg border-2 overflow-hidden">
          <Skeleton className="w-full h-full" />
        </div>
      ))}
    </div>
  );
}

