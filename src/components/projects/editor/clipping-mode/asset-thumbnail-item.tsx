"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AssetWithFullData } from "@/types/asset";
import { Video, AudioLines } from "lucide-react";
import Image from "next/image";
import { useTimelineDrag } from "./timeline-drag-context";

interface AssetThumbnailItemProps {
  asset: AssetWithFullData;
}

/**
 * 素材缩略图 - 支持拖拽到时间轴
 */
export function AssetThumbnailItem({ asset }: AssetThumbnailItemProps) {
  const { setDraggedAsset, updateDragPreviewPosition, resetDrag, isDragging, draggedAsset } = useTimelineDrag();
  const [isMouseDown, setIsMouseDown] = useState(false);
  const dragThreshold = 5; // 拖拽阈值（像素）
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const isThisItemDragging = isDragging && draggedAsset?.id === asset.id;

  // 鼠标按下
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsMouseDown(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  // 鼠标移动（全局监听）
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isMouseDown || !startPosRef.current) return;

    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 超过阈值才开始拖拽
    if (distance > dragThreshold && !isDragging) {
      setDraggedAsset(asset, { x: e.clientX, y: e.clientY });
    }

    // 更新拖拽预览位置
    if (isDragging) {
      updateDragPreviewPosition({ x: e.clientX, y: e.clientY });
    }
  }, [isMouseDown, isDragging, asset, setDraggedAsset, updateDragPreviewPosition, dragThreshold]);

  // 鼠标释放（全局监听）
  const handleMouseUp = useCallback(() => {
    setIsMouseDown(false);
    startPosRef.current = null;

    // 拖拽状态的清理由 TimelinePanel 的 drop 处理器负责
    // 这里只重置本地状态
  }, []);

  // 添加/移除全局监听器
  useEffect(() => {
    if (isMouseDown) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isMouseDown, handleMouseMove, handleMouseUp]);

  return (
    <button
      onMouseDown={handleMouseDown}
      className="group relative flex-shrink-0 rounded-lg border bg-card overflow-hidden hover:border-primary transition-all hover:shadow-md cursor-grab active:cursor-grabbing"
      style={{
        width: 56,
        height: 56,
        opacity: isThisItemDragging ? 0.5 : 1,
      }}
      title={asset.name}
    >
      {asset.displayUrl && asset.assetType === "video" ? (
        <Image
          src={asset.displayUrl}
          alt={asset.name}
          fill
          className="object-cover"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          {asset.assetType === "video" ? (
            <Video className="h-5 w-5 text-muted-foreground" />
          ) : (
            <AudioLines className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      )}

      {/* 时长标签 */}
      {asset.duration && (
        <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded text-[10px] bg-black/70 text-white font-medium">
          {Math.floor(asset.duration / 1000)}s
        </div>
      )}

      {/* 悬停遮罩 */}
      <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </button>
  );
}
