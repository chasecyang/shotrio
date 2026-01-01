"use client";

import { useState, useRef, useEffect } from "react";
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
import { validateTrimValues, formatTimeDisplay } from "@/lib/utils/timeline-utils";
import { toast } from "sonner";

interface TimelineClipItemProps {
  clip: TimelineClipWithAsset;
  allClips: TimelineClipWithAsset[];
  pixelsPerMs: number;
  trackRef: React.RefObject<HTMLDivElement | null>;
  temporaryStartTime?: number;
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
export function TimelineClipItem({
  clip,
  allClips,
  pixelsPerMs,
  trackRef,
  temporaryStartTime,
  onDelete,
  onDragStart,
  onDragEnd,
  onTrimming,
  onTrim,
  isDragging,
  disabled = false,
}: TimelineClipItemProps) {
  const clipRef = useRef<HTMLDivElement>(null);
  
  // 拖拽状态
  const [isDraggingClip, setIsDraggingClip] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const originalStartTime = useRef(0);

  // 裁剪状态
  const [isTrimmingLeft, setIsTrimmingLeft] = useState(false);
  const [isTrimmingRight, setIsTrimmingRight] = useState(false);
  const [trimStartX, setTrimStartX] = useState(0);
  const [tempTrimStart, setTempTrimStart] = useState(clip.trimStart);
  const [tempDuration, setTempDuration] = useState(clip.duration);

  const left = clip.startTime * pixelsPerMs;
  const width = clip.duration * pixelsPerMs;

  // 拖拽片段移动
  const handleMouseDownOnClip = (e: React.MouseEvent) => {
    if (disabled || isTrimmingLeft || isTrimmingRight) return;
    
    e.stopPropagation();
    setIsDraggingClip(true);
    setDragStartX(e.clientX);
    setDragOffset(0);
    originalStartTime.current = clip.startTime;
    onDragStart();
  };

  useEffect(() => {
    if (!isDraggingClip) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX;
      setDragOffset(deltaX);
    };

    const handleMouseUp = () => {
      setIsDraggingClip(false);
      
      // 计算新的开始时间
      const deltaMs = dragOffset / pixelsPerMs;
      const newStartTime = Math.max(0, originalStartTime.current + deltaMs);
      
      setDragOffset(0);
      
      // 如果位置真的改变了，触发回调
      if (Math.abs(newStartTime - clip.startTime) > 10) {
        onDragEnd(clip.id, newStartTime);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingClip, dragStartX, dragOffset, pixelsPerMs, clip, onDragEnd]);

  // 左边缘裁剪（调整入点）
  const handleMouseDownLeft = (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    setIsTrimmingLeft(true);
    setTrimStartX(e.clientX);
    setTempTrimStart(clip.trimStart);
    setTempDuration(clip.duration);
  };

  useEffect(() => {
    if (!isTrimmingLeft) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - trimStartX;
      const deltaMs = deltaX / pixelsPerMs;

      // 新的 trimStart 和 duration
      const newTrimStart = Math.max(0, clip.trimStart + deltaMs);
      const newDuration = Math.max(500, clip.duration - deltaMs);

      // 验证是否超出素材时长
      const assetDuration = clip.asset.duration || 0;
      const validation = validateTrimValues(newTrimStart, newDuration, assetDuration);

      if (validation.valid) {
        setTempTrimStart(newTrimStart);
        setTempDuration(newDuration);
        // 左边缘裁剪不影响后续片段位置，但需要通知以便更新预览
        onTrimming?.(clip.id, newDuration);
      }
    };

    const handleMouseUp = () => {
      setIsTrimmingLeft(false);

      // 如果真的改变了，保存
      if (
        Math.abs(tempTrimStart - clip.trimStart) > 10 ||
        Math.abs(tempDuration - clip.duration) > 10
      ) {
        onTrim(clip.id, tempTrimStart, tempDuration);
      } else {
        // 没有改变，清除预览状态
        onTrimming?.(clip.id, clip.duration);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isTrimmingLeft, trimStartX, pixelsPerMs, clip, tempTrimStart, tempDuration, onTrim, onTrimming]);

  // 右边缘裁剪（调整出点）
  const handleMouseDownRight = (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    setIsTrimmingRight(true);
    setTrimStartX(e.clientX);
    setTempDuration(clip.duration);
  };

  useEffect(() => {
    if (!isTrimmingRight) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - trimStartX;
      const deltaMs = deltaX / pixelsPerMs;

      // 新的 duration
      const newDuration = Math.max(500, clip.duration + deltaMs);

      // 验证是否超出素材时长
      const assetDuration = clip.asset.duration || 0;
      const validation = validateTrimValues(clip.trimStart, newDuration, assetDuration);

      if (validation.valid) {
        setTempDuration(newDuration);
        // 实时通知父组件，用于推移后续片段
        onTrimming?.(clip.id, newDuration);
      }
    };

    const handleMouseUp = () => {
      setIsTrimmingRight(false);

      // 如果真的改变了，保存
      if (Math.abs(tempDuration - clip.duration) > 10) {
        onTrim(clip.id, clip.trimStart, tempDuration);
      } else {
        // 没有改变，清除预览状态
        onTrimming?.(clip.id, clip.duration);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isTrimmingRight, trimStartX, pixelsPerMs, clip, tempDuration, onTrim, onTrimming]);

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
            "absolute top-2 h-20 rounded-lg border-2 bg-card overflow-hidden transition-colors",
            isDraggingClip || isDragging ? "opacity-50 cursor-grabbing" : "cursor-grab",
            isTrimmingLeft || isTrimmingRight ? "border-primary" : "hover:border-primary",
            disabled && "pointer-events-none opacity-50"
          )}
          style={{
            left: `${displayLeft}px`,
            width: `${displayWidth}px`,
          }}
        >
          {/* 背景缩略图 */}
          {clip.asset.thumbnailUrl || clip.asset.imageUrl ? (
            <div className="absolute inset-0 opacity-30 pointer-events-none">
              <Image
                src={clip.asset.thumbnailUrl || clip.asset.imageUrl!}
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
}

