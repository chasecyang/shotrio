"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Trash2, Check, Clock, Loader2, Play } from "lucide-react";
import { useAssetVersions } from "@/hooks/use-asset-versions";
import type { AssetWithFullData, ImageData, VideoData } from "@/types/asset";

interface AssetVersionPanelProps {
  asset: AssetWithFullData;
  onVersionChange?: () => void;
  className?: string;
}

/**
 * 资产版本历史面板
 *
 * 显示资产的所有版本，支持：
 * - 版本切换（点击激活）
 * - 版本删除（带确认对话框）
 * - 显示每个版本的缩略图和创建时间
 */
export function AssetVersionPanel({
  asset,
  onVersionChange,
  className,
}: AssetVersionPanelProps) {
  const {
    versions,
    activeVersion,
    versionCount,
    isPending,
    error,
    switchVersion,
    removeVersion,
  } = useAssetVersions(asset, { onVersionChange });

  const [versionToDelete, setVersionToDelete] = useState<string | null>(null);

  if (versionCount <= 1) {
    return null;
  }

  const isImage = asset.assetType === "image";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">版本历史</h4>
        <Badge variant="secondary" className="text-xs">
          {versionCount} 个版本
        </Badge>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <ScrollArea className="h-[200px] pr-3">
        <div className="space-y-2">
          {versions.map((version, index) => {
            const isActive = version.id === activeVersion?.id;
            const thumbnailUrl = isImage
              ? (version as ImageData).thumbnailUrl || (version as ImageData).imageUrl
              : (version as VideoData).thumbnailUrl;
            const createdAt = version.createdAt;

            return (
              <div
                key={version.id}
                className={cn(
                  "group relative flex items-center gap-3 p-2 rounded-md border transition-colors cursor-pointer",
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-accent/50",
                  isPending && "pointer-events-none opacity-60"
                )}
                onClick={() => !isActive && switchVersion(version.id)}
              >
                {/* 缩略图 */}
                <div className="relative w-16 h-10 rounded overflow-hidden bg-muted shrink-0">
                  {thumbnailUrl ? (
                    isImage ? (
                      <Image
                        src={thumbnailUrl}
                        alt={`版本 ${versionCount - index}`}
                        fill
                        className="object-cover"
                        sizes="64px"
                        quality={80}
                      />
                    ) : (
                      <div className="relative w-full h-full">
                        <Image
                          src={thumbnailUrl}
                          alt={`版本 ${versionCount - index}`}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <span className="text-[10px]">无预览</span>
                    </div>
                  )}
                </div>

                {/* 版本信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      版本 {versionCount - index}
                    </span>
                    {isActive && (
                      <Badge
                        variant="default"
                        className="text-[10px] px-1.5 py-0"
                      >
                        当前
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      {createdAt
                        ? new Date(createdAt).toLocaleString("zh-CN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-1 shrink-0">
                  {isActive ? (
                    <div className="w-7 h-7 flex items-center justify-center text-primary">
                      <Check className="h-4 w-4" />
                    </div>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <AlertDialog>
                          <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p>删除此版本</p>
                          </TooltipContent>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>确认删除版本</AlertDialogTitle>
                              <AlertDialogDescription>
                                确定要删除版本 {versionCount - index} 吗？此操作无法撤销。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => removeVersion(version.id)}
                              >
                                删除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {isPending && (
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>处理中...</span>
        </div>
      )}
    </div>
  );
}

/**
 * 版本数量徽章
 * 用于在 AssetCard 上显示版本数
 */
export function VersionCountBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 1) return null;

  return (
    <Badge
      variant="secondary"
      className={cn(
        "absolute top-2 left-2 text-[10px] px-1.5 py-0 bg-black/60 text-white border-0",
        className
      )}
    >
      {count} 版本
    </Badge>
  );
}
