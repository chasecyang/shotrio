"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { AssetWithFullData } from "@/types/asset";

interface TimelineDragContextValue {
  // 当前拖拽的素材
  draggedAsset: AssetWithFullData | null;
  // 拖拽预览位置
  dragPreviewPosition: { x: number; y: number } | null;
  // 目标轨道索引
  dropTargetTrack: number | null;
  // 插入位置（时间）
  dropPosition: number | null;
  // 是否正在拖拽
  isDragging: boolean;

  // 设置拖拽素材和开始位置
  setDraggedAsset: (asset: AssetWithFullData | null, position?: { x: number; y: number }) => void;
  // 更新拖拽预览位置
  updateDragPreviewPosition: (position: { x: number; y: number }) => void;
  // 设置 drop 目标
  setDropTarget: (track: number | null, position: number | null) => void;
  // 重置拖拽状态
  resetDrag: () => void;
}

const TimelineDragContext = createContext<TimelineDragContextValue | null>(null);

export function TimelineDragProvider({ children }: { children: ReactNode }) {
  const [draggedAsset, setDraggedAssetState] = useState<AssetWithFullData | null>(null);
  const [dragPreviewPosition, setDragPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const [dropTargetTrack, setDropTargetTrack] = useState<number | null>(null);
  const [dropPosition, setDropPositionState] = useState<number | null>(null);

  const isDragging = draggedAsset !== null;

  const setDraggedAsset = (asset: AssetWithFullData | null, position?: { x: number; y: number }) => {
    setDraggedAssetState(asset);
    if (position) {
      setDragPreviewPosition(position);
    } else if (!asset) {
      setDragPreviewPosition(null);
    }
  };

  const updateDragPreviewPosition = (position: { x: number; y: number }) => {
    setDragPreviewPosition(position);
  };

  const setDropTarget = (track: number | null, position: number | null) => {
    setDropTargetTrack(track);
    setDropPositionState(position);
  };

  const resetDrag = () => {
    setDraggedAssetState(null);
    setDragPreviewPosition(null);
    setDropTargetTrack(null);
    setDropPositionState(null);
  };

  return (
    <TimelineDragContext.Provider
      value={{
        draggedAsset,
        dragPreviewPosition,
        dropTargetTrack,
        dropPosition,
        isDragging,
        setDraggedAsset,
        updateDragPreviewPosition,
        setDropTarget,
        resetDrag,
      }}
    >
      {children}
    </TimelineDragContext.Provider>
  );
}

export function useTimelineDrag() {
  const context = useContext(TimelineDragContext);
  if (!context) {
    throw new Error("useTimelineDrag must be used within TimelineDragProvider");
  }
  return context;
}
