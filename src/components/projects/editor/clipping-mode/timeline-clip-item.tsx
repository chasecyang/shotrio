"use client";

import React, { useRef } from "react";
import { TimelineClipWithAsset } from "@/types/timeline";
import { Trash2, GripVertical, Scissors } from "lucide-react";
import Image from "next/image";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { formatTimeDisplay } from "@/lib/utils/timeline-utils";
import { useClipInteraction } from "@/hooks/use-clip-interaction";

interface TimelineClipItemProps {
  clip: TimelineClipWithAsset;
  pixelsPerMs: number;
  temporaryStartTime?: number;
  trackColor?: string;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: (clipId: string, newStartTime: number) => void;
  onTrimming?: (clipId: string, newDuration: number) => void;
  onTrim: (clipId: string, trimStart: number, duration: number) => void;
  isDragging: boolean;
  disabled?: boolean;
}

/**
 * 时间轴片段组件
 * 支持拖拽移动和裁剪功能
 */
export const TimelineClipItem = React.memo(function TimelineClipItem({
  clip,
  pixelsPerMs,
  temporaryStartTime,
  trackColor = "#3b82f6",
  onDelete,
  onDragStart,
  onDragEnd,
  onTrimming,
  onTrim,
  isDragging,
  disabled = false,
}: TimelineClipItemProps) {
  const clipRef = useRef<HTMLDivElement>(null);

  const {
    isDraggingClip,
    dragOffset,
    isTrimmingLeft,
    isTrimmingRight,
    tempTrimStart,
    tempDuration,
    handleMouseDownOnClip,
    handleMouseDownLeft,
    handleMouseDownRight,
  } = useClipInteraction({
    clip: {
      id: clip.id,
      startTime: clip.startTime,
      trimStart: clip.trimStart,
      duration: clip.duration,
      assetDuration: clip.asset.duration || 0,
    },
    pixelsPerMs,
    disabled,
    onDragStart,
    onDragEnd,
    onTrim,
    onTrimming,
  });

  // 计算显示位置和宽度（考虑临时裁剪状态和临时位置）
  const effectiveStartTime = temporaryStartTime !== undefined ? temporaryStartTime : clip.startTime;
  const displayLeft = isTrimmingLeft
    ? (effectiveStartTime + (tempTrimStart - clip.trimStart)) * pixelsPerMs
    : effectiveStartTime * pixelsPerMs + dragOffset;
  const displayWidth = (isTrimmingLeft || isTrimmingRight ? tempDuration : clip.duration) * pixelsPerMs;

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          ref={clipRef}
          onMouseDown={handleMouseDownOnClip}
          className={cn(
            "absolute top-1 bottom-1 rounded-md border overflow-hidden transition-colors",
            isDraggingClip || isDragging ? "opacity-50 cursor-grabbing" : "cursor-grab",
            isTrimmingLeft || isTrimmingRight ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-primary",
            disabled && "pointer-events-none opacity-50"
          )}
          style={{
            left: `${displayLeft}px`,
            width: `${displayWidth}px`,
            backgroundColor: `${trackColor}20`,
            borderColor: `${trackColor}60`,
          }}
        >
          {/* 背景缩略图 */}
          {clip.asset.displayUrl ? (
            <div className="absolute inset-0 opacity-30 pointer-events-none">
              <Image
                src={clip.asset.displayUrl}
                alt={clip.asset.name}
                fill
                className="object-cover"
              />
            </div>
          ) : null}

          {/* 前景内容 */}
          <div className="relative h-full p-2 flex flex-col justify-between pointer-events-none">
            {/* 顶部：拖动手柄 */}
            <div className="flex items-start gap-1">
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-medium truncate flex-1">
                {clip.asset.name}
              </span>
            </div>

            {/* 底部：时长 */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {Math.floor((isTrimmingLeft || isTrimmingRight ? tempDuration : clip.duration) / 1000)}s
              </span>
              {clip.trimStart > 0 || clip.trimEnd ? (
                <div className="flex items-center gap-1">
                  <Scissors className="h-3 w-3 text-primary" />
                  <span className="text-xs text-primary">已裁剪</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* 左边缘：调整入点手柄 */}
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize group/left-handle z-10",
              "before:absolute before:inset-y-0 before:-left-2 before:-right-2 before:content-['']"
            )}
            onMouseDown={handleMouseDownLeft}
          >
            <div
              className={cn(
                "h-full w-1 transition-all",
                isTrimmingLeft
                  ? "bg-primary scale-x-150"
                  : "bg-transparent group-hover/left-handle:bg-primary/50"
              )}
            />

            {/* 裁剪时显示时间提示 */}
            {isTrimmingLeft && (
              <div className="absolute -top-8 left-0 bg-primary text-primary-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
                入点: {formatTimeDisplay(tempTrimStart)} | 时长: {formatTimeDisplay(tempDuration)}
              </div>
            )}
          </div>

          {/* 右边缘：调整出点手柄 */}
          <div
            className={cn(
              "absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize group/right-handle z-10",
              "before:absolute before:inset-y-0 before:-left-2 before:-right-2 before:content-['']"
            )}
            onMouseDown={handleMouseDownRight}
          >
            <div
              className={cn(
                "h-full w-1 transition-all",
                isTrimmingRight
                  ? "bg-primary scale-x-150"
                  : "bg-transparent group-hover/right-handle:bg-primary/50"
              )}
            />

            {/* 裁剪时显示时间提示 */}
            {isTrimmingRight && (
              <div className="absolute -top-8 right-0 bg-primary text-primary-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
                出点: {formatTimeDisplay(clip.trimStart + tempDuration)} | 时长: {formatTimeDisplay(tempDuration)}
              </div>
            )}
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          删除片段
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数：只在关键 props 改变时重新渲染
  return (
    prevProps.clip.id === nextProps.clip.id &&
    prevProps.clip.startTime === nextProps.clip.startTime &&
    prevProps.clip.duration === nextProps.clip.duration &&
    prevProps.clip.trimStart === nextProps.clip.trimStart &&
    prevProps.pixelsPerMs === nextProps.pixelsPerMs &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.temporaryStartTime === nextProps.temporaryStartTime &&
    prevProps.trackColor === nextProps.trackColor
  );
});
