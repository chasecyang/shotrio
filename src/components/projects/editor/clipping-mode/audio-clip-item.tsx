"use client";

import React, { useRef, useEffect, useMemo } from "react";
import { TimelineClipWithAsset } from "@/types/timeline";
import { Trash2, GripVertical, Scissors, AudioLines } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { formatTimeDisplay } from "@/lib/utils/timeline-utils";
import { deserializeWaveform } from "@/lib/utils/waveform-utils";
import { useClipInteraction } from "@/hooks/use-clip-interaction";

interface AudioClipItemProps {
  clip: TimelineClipWithAsset;
  pixelsPerMs: number;
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
 * 波形渲染组件
 */
function WaveformCanvas({
  waveformData,
  width,
  height,
  trimStart,
  duration,
  assetDuration,
}: {
  waveformData: number[];
  width: number;
  height: number;
  trimStart: number;
  duration: number;
  assetDuration: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0 || width <= 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const totalSamples = waveformData.length;
    const startRatio = trimStart / assetDuration;
    const endRatio = (trimStart + duration) / assetDuration;
    const startIndex = Math.floor(startRatio * totalSamples);
    const endIndex = Math.ceil(endRatio * totalSamples);
    const visibleSamples = waveformData.slice(startIndex, endIndex);

    if (visibleSamples.length === 0) return;

    const barWidth = width / visibleSamples.length;
    const centerY = height / 2;

    // 使用 CSS 变量获取 primary 颜色
    const primaryColor = getComputedStyle(canvas).getPropertyValue("--primary").trim();
    ctx.fillStyle = primaryColor ? `oklch(${primaryColor})` : "oklch(0.55 0.18 40)";

    visibleSamples.forEach((value, index) => {
      const barHeight = value * (height * 0.8);
      const x = index * barWidth;
      const y = centerY - barHeight / 2;

      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    });
  }, [waveformData, width, height, trimStart, duration, assetDuration]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none opacity-60"
    />
  );
}

/**
 * 音频时间轴片段组件
 * 支持拖拽移动、裁剪和波形显示
 */
export const AudioClipItem = React.memo(function AudioClipItem({
  clip,
  pixelsPerMs,
  temporaryStartTime,
  onDelete,
  onDragStart,
  onDragEnd,
  onTrimming,
  onTrim,
  isDragging,
  disabled = false,
}: AudioClipItemProps) {
  const clipRef = useRef<HTMLDivElement>(null);

  // 解析波形数据
  const waveformData = useMemo(() => {
    const audioData = clip.asset.audioData;
    if (!audioData?.waveformData) return [];
    return deserializeWaveform(audioData.waveformData);
  }, [clip.asset.audioData]);

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

  // 计算显示位置和宽度
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
            "bg-primary/10 border-primary/30",
            isDraggingClip || isDragging ? "opacity-50 cursor-grabbing" : "cursor-grab",
            isTrimmingLeft || isTrimmingRight ? "ring-2 ring-primary dark:shadow-[var(--safelight-glow)]" : "hover:ring-1 hover:ring-primary",
            disabled && "pointer-events-none opacity-50"
          )}
          style={{
            left: `${displayLeft}px`,
            width: `${displayWidth}px`,
          }}
        >
          {/* 波形背景 */}
          {waveformData.length > 0 ? (
            <WaveformCanvas
              waveformData={waveformData}
              width={displayWidth}
              height={54}
              trimStart={isTrimmingLeft ? tempTrimStart : clip.trimStart}
              duration={isTrimmingLeft || isTrimmingRight ? tempDuration : clip.duration}
              assetDuration={clip.asset.duration || 1}
            />
          ) : (
            // 无波形数据时显示占位图案
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
              <AudioLines className="h-6 w-6 text-primary" />
            </div>
          )}

          {/* 前景内容 */}
          <div className="relative h-full p-1.5 flex flex-col justify-between pointer-events-none z-10">
            {/* 顶部：拖动手柄和名称 */}
            <div className="flex items-start gap-1">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-medium truncate flex-1 drop-shadow-sm">
                {clip.asset.name}
              </span>
            </div>

            {/* 底部：时长和裁剪指示 */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground drop-shadow-sm">
                {Math.floor((isTrimmingLeft || isTrimmingRight ? tempDuration : clip.duration) / 1000)}s
              </span>
              {clip.trimStart > 0 || clip.trimEnd ? (
                <div className="flex items-center gap-0.5">
                  <Scissors className="h-3 w-3 text-primary" />
                </div>
              ) : null}
            </div>
          </div>

          {/* 左边缘：调整入点手柄 */}
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize group/left-handle z-20",
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

            {isTrimmingLeft && (
              <div className="absolute -top-8 left-0 bg-primary text-primary-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
                入点: {formatTimeDisplay(tempTrimStart)} | 时长: {formatTimeDisplay(tempDuration)}
              </div>
            )}
          </div>

          {/* 右边缘：调整出点手柄 */}
          <div
            className={cn(
              "absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize group/right-handle z-20",
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
  return (
    prevProps.clip.id === nextProps.clip.id &&
    prevProps.clip.startTime === nextProps.clip.startTime &&
    prevProps.clip.duration === nextProps.clip.duration &&
    prevProps.clip.trimStart === nextProps.clip.trimStart &&
    prevProps.pixelsPerMs === nextProps.pixelsPerMs &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.temporaryStartTime === nextProps.temporaryStartTime
  );
});
