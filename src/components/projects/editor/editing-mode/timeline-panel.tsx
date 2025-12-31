"use client";

import { useState, useRef } from "react";
import { useEditor } from "../editor-context";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ZoomIn, ZoomOut, Trash2 } from "lucide-react";
import { TimelineClipItem } from "./timeline-clip-item";
import { addClipToTimeline, removeClip, reorderClips } from "@/lib/actions/timeline";
import { toast } from "sonner";
import { TimelineClipWithAsset } from "@/types/timeline";

/**
 * 时间轴面板组件
 */
export function TimelinePanel() {
  const { state, updateTimeline } = useEditor();
  const { timeline } = state;
  
  const [zoom, setZoom] = useState(1); // 缩放级别
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  if (!timeline) return null;

  const pixelsPerMs = 0.1 * zoom; // 每毫秒对应的像素数

  // 处理从素材库拖入
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      
      if (data.assetId) {
        // 计算drop的位置时间
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const x = e.clientX - rect.left;
        const startTime = Math.max(0, Math.floor(x / pixelsPerMs));
        
        // 添加片段到时间轴
        const result = await addClipToTimeline(timeline.id, {
          assetId: data.assetId,
          trackIndex: 0,
          startTime,
          duration: data.duration || 0,
          trimStart: 0,
        });

        if (result.success && result.timeline) {
          updateTimeline(result.timeline);
          toast.success("已添加到时间轴");
        } else {
          toast.error(result.error || "添加失败");
        }
      }
    } catch (error) {
      console.error("拖拽处理失败:", error);
      toast.error("添加失败");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  // 删除片段
  const handleDeleteClip = async (clipId: string) => {
    const result = await removeClip(clipId);
    if (result.success && result.timeline) {
      updateTimeline(result.timeline);
      toast.success("已删除片段");
    } else {
      toast.error(result.error || "删除失败");
    }
  };

  // 片段拖拽开始
  const handleClipDragStart = (clipId: string) => {
    setDraggedClipId(clipId);
  };

  // 片段拖拽结束
  const handleClipDragEnd = () => {
    setDraggedClipId(null);
  };

  // 缩放控制
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 0.2));
  };

  // 生成时间标尺
  const generateTimeRuler = () => {
    const totalWidth = (timeline.duration || 10000) * pixelsPerMs;
    const stepMs = 5000; // 每5秒一个标记
    const marks: { time: number; label: string }[] = [];

    for (let time = 0; time <= timeline.duration; time += stepMs) {
      marks.push({
        time,
        label: `${Math.floor(time / 1000)}s`,
      });
    }

    return { totalWidth, marks };
  };

  const { totalWidth, marks } = generateTimeRuler();

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 工具栏 */}
      <div className="h-10 border-b flex items-center px-4 gap-2 shrink-0">
        <span className="text-xs font-medium text-muted-foreground">时间轴</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleZoomOut}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleZoomIn}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 时间轴主体 */}
      <ScrollArea className="flex-1">
        <div className="p-4 min-w-max">
          {/* 时间标尺 */}
          <div className="relative h-8 border-b mb-2" style={{ width: totalWidth }}>
            {marks.map((mark) => (
              <div
                key={mark.time}
                className="absolute top-0 h-full"
                style={{ left: mark.time * pixelsPerMs }}
              >
                <div className="w-px h-2 bg-border" />
                <span className="absolute top-2 left-0 text-xs text-muted-foreground -translate-x-1/2">
                  {mark.label}
                </span>
              </div>
            ))}
          </div>

          {/* 轨道 */}
          <div
            ref={trackRef}
            className="relative h-24 border rounded-lg bg-muted/20"
            style={{ width: Math.max(totalWidth, 800) }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {timeline.clips.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                拖入素材到此处
              </div>
            ) : (
              timeline.clips.map((clip) => (
                <TimelineClipItem
                  key={clip.id}
                  clip={clip}
                  pixelsPerMs={pixelsPerMs}
                  onDelete={() => handleDeleteClip(clip.id)}
                  onDragStart={() => handleClipDragStart(clip.id)}
                  onDragEnd={handleClipDragEnd}
                  isDragging={draggedClipId === clip.id}
                />
              ))
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

