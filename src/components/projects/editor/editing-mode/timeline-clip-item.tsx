"use client";

import { useState, useRef } from "react";
import { TimelineClipWithAsset } from "@/types/timeline";
import { Button } from "@/components/ui/button";
import { Trash2, GripVertical } from "lucide-react";
import Image from "next/image";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface TimelineClipItemProps {
  clip: TimelineClipWithAsset;
  pixelsPerMs: number;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

/**
 * 时间轴片段组件
 */
export function TimelineClipItem({
  clip,
  pixelsPerMs,
  onDelete,
  onDragStart,
  onDragEnd,
  isDragging,
}: TimelineClipItemProps) {
  const [isResizing, setIsResizing] = useState(false);
  const clipRef = useRef<HTMLDivElement>(null);

  const left = clip.startTime * pixelsPerMs;
  const width = clip.duration * pixelsPerMs;

  const handleDragStart = (e: React.DragEvent) => {
    onDragStart();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", clip.id);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          ref={clipRef}
          draggable
          onDragStart={handleDragStart}
          onDragEnd={onDragEnd}
          className={`absolute top-2 h-20 rounded-lg border-2 bg-card overflow-hidden cursor-move hover:border-primary transition-colors ${
            isDragging ? "opacity-50" : ""
          }`}
          style={{
            left: `${left}px`,
            width: `${width}px`,
          }}
        >
          {/* 背景缩略图 */}
          {clip.asset.thumbnailUrl || clip.asset.imageUrl ? (
            <div className="absolute inset-0 opacity-30">
              <Image
                src={clip.asset.thumbnailUrl || clip.asset.imageUrl!}
                alt={clip.asset.name}
                fill
                className="object-cover"
              />
            </div>
          ) : null}

          {/* 前景内容 */}
          <div className="relative h-full p-2 flex flex-col justify-between">
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
                {Math.floor(clip.duration / 1000)}s
              </span>
              {clip.trimStart > 0 || clip.trimEnd ? (
                <span className="text-xs text-primary">已裁剪</span>
              ) : null}
            </div>
          </div>

          {/* 左右边缘：调整大小手柄 */}
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-primary/50 transition-colors"
            onMouseDown={(e) => {
              e.stopPropagation();
              // TODO: 实现左边缘拖拽调整入点
            }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-primary/50 transition-colors"
            onMouseDown={(e) => {
              e.stopPropagation();
              // TODO: 实现右边缘拖拽调整出点
            }}
          />
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

