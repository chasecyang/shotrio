import { useState, useCallback, useRef, useEffect } from "react";
import { TimelineClipWithAsset } from "@/types/timeline";
import { calculateTimeFromPosition, snapToNearbyClips } from "@/lib/utils/timeline-utils";

interface UseClipDragOptions {
  clip: TimelineClipWithAsset;
  allClips: TimelineClipWithAsset[];
  pixelsPerMs: number;
  trackRef: React.RefObject<HTMLElement>;
  onDragEnd: (clipId: string, newStartTime: number) => void;
}

interface UseClipDragReturn {
  isDragging: boolean;
  dragOffset: number;
  handleDragStart: (e: React.DragEvent | React.MouseEvent) => void;
  handleDragEnd: () => void;
}

/**
 * 片段拖拽功能 Hook
 * 处理片段在时间轴上的拖拽移动和重排序
 */
export function useClipDrag({
  clip,
  allClips,
  pixelsPerMs,
  trackRef,
  onDragEnd,
}: UseClipDragOptions): UseClipDragReturn {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartX = useRef(0);
  const originalStartTime = useRef(0);

  const handleDragStart = useCallback(
    (e: React.DragEvent | React.MouseEvent) => {
      setIsDragging(true);
      originalStartTime.current = clip.startTime;
      
      // 记录拖拽起始位置
      const clientX = "clientX" in e ? e.clientX : (e as React.DragEvent).clientX;
      dragStartX.current = clientX;
      setDragOffset(0);
    },
    [clip.startTime]
  );

  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !trackRef.current) return;

      const deltaX = e.clientX - dragStartX.current;
      setDragOffset(deltaX);
    },
    [isDragging, trackRef]
  );

  const handleDragEnd = useCallback(() => {
    if (!isDragging || !trackRef.current) return;

    // 计算新的开始时间
    const deltaMs = dragOffset / pixelsPerMs;
    let newStartTime = Math.max(0, originalStartTime.current + deltaMs);

    // 应用磁吸效果
    newStartTime = snapToNearbyClips(newStartTime, allClips, clip.id);

    setIsDragging(false);
    setDragOffset(0);

    // 如果位置真的改变了，触发回调
    if (Math.abs(newStartTime - clip.startTime) > 10) {
      onDragEnd(clip.id, newStartTime);
    }
  }, [isDragging, dragOffset, pixelsPerMs, trackRef, clip, allClips, onDragEnd]);

  // 监听鼠标移动和释放
  useEffect(() => {
    if (!isDragging) return;

    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);

    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  return {
    isDragging,
    dragOffset,
    handleDragStart,
    handleDragEnd,
  };
}

