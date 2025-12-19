"use client";

import { useState, useCallback } from "react";
import { ShotDetail } from "@/types/project";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Image as ImageIcon, GripVertical, Video, FileText } from "lucide-react";
import { updateShot } from "@/lib/actions/project";
import { useEditor } from "../editor-context";
import { toast } from "sonner";
import { formatDuration } from "@/lib/utils/shot-utils";
import Image from "next/image";

interface ShotClipProps {
  shot: ShotDetail;
  isSelected: boolean;
  pixelsPerMs: number;
  onClick: (e: React.MouseEvent) => void;
}

export function ShotClip({ shot, isSelected, pixelsPerMs, onClick }: ShotClipProps) {
  const { state, dispatch } = useEditor();
  const [isResizing, setIsResizing] = useState(false);
  const [originalDuration, setOriginalDuration] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const duration = shot.duration || 3000;
  const width = duration * pixelsPerMs;
  const minWidth = 500 * pixelsPerMs; // 最小 0.5 秒

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: `${width}px`,
    minWidth: `${minWidth}px`,
  };

  // 开始调整时长
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsResizing(true);
      setOriginalDuration(duration);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - e.clientX;
        const deltaDuration = deltaX / pixelsPerMs;
        const newDuration = Math.max(500, originalDuration + deltaDuration);

        // 实时更新本地状态（乐观更新）
        const updatedShots = state.shots.map((s) =>
          s.id === shot.id ? { ...s, duration: Math.round(newDuration) } : s
        );
        dispatch({ type: "SET_SHOTS", payload: updatedShots });
      };

      const handleMouseUp = async () => {
        setIsResizing(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);

        // 保存到服务器
        const updatedShot = state.shots.find((s) => s.id === shot.id);
        if (updatedShot && updatedShot.duration !== originalDuration) {
          try {
            const result = await updateShot(shot.id, {
              duration: updatedShot.duration,
            });
            if (!result.success) {
              toast.error("更新时长失败");
              // 恢复原始时长
              const restoredShots = state.shots.map((s) =>
                s.id === shot.id ? { ...s, duration: originalDuration } : s
              );
              dispatch({ type: "SET_SHOTS", payload: restoredShots });
            }
          } catch (error) {
            console.error(error);
            toast.error("更新时长失败");
          }
        }
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [duration, originalDuration, pixelsPerMs, shot.id, state.shots, dispatch]
  );

  // 处理素材拖拽放置
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const data = e.dataTransfer.getData("application/json");
      if (!data) return;

      const { assetId, assetType } = JSON.parse(data);
      if (!assetId) return;

      // 更新分镜关联的素材
      const result = await updateShot(shot.id, {
        imageAssetId: assetId,
      });

      if (result.success) {
        toast.success("素材已应用到分镜");
        // 刷新分镜数据
        dispatch({ type: "UPDATE_SHOT", payload: { ...shot, imageAssetId: assetId } });
      } else {
        toast.error(result.error || "应用失败");
      }
    } catch (error) {
      console.error("应用素材失败:", error);
      toast.error("应用素材失败");
    }
  }, [shot, dispatch]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative h-full rounded-lg overflow-hidden border-2 transition-colors cursor-pointer shrink-0",
        "bg-gradient-to-b from-muted/40 to-muted/20",
        isSelected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/40",
        isDragging && "opacity-50 z-50",
        isResizing && "select-none",
        isDragOver && "border-primary ring-2 ring-primary/50 bg-primary/10"
      )}
      onClick={onClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 分镜内容 */}
      <div className="absolute inset-0 flex">
        {/* 左侧：拖拽手柄 + 缩略图 */}
        <div className="flex items-center gap-1 p-1.5">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded"
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {/* 缩略图 */}
          <div className="w-12 h-full rounded bg-muted/50 flex items-center justify-center overflow-hidden relative">
            {shot.imageUrl ? (
              <>
                <Image
                  src={shot.imageUrl}
                  alt={`#${shot.order}`}
                  fill
                  className="object-cover"
                />
                {/* 视频标识 */}
                {shot.videoUrl && (
                  <div className="absolute bottom-0.5 right-0.5 bg-primary rounded px-1 py-0.5">
                    <Video className="w-2.5 h-2.5 text-primary-foreground" />
                  </div>
                )}
              </>
            ) : (
              <>
                {/* 无图片，显示文字图标 */}
                <FileText className="w-4 h-4 text-muted-foreground/50" />
                {/* 状态提示 */}
                <div className="absolute bottom-0 left-0 right-0 bg-muted/80 text-[8px] text-muted-foreground text-center py-0.5">
                  无图
                </div>
              </>
            )}
          </div>
        </div>

        {/* 中间：分镜信息 */}
        <div className="flex-1 min-w-0 p-1.5 flex flex-col justify-center">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono text-foreground">#{shot.order}</span>
            <span className="text-xs text-muted-foreground">
              {formatDuration(duration)}
            </span>
            {/* 内容状态图标 */}
            <div className="flex items-center gap-0.5 ml-auto">
              {shot.videoUrl && (
                <Video className="w-3 h-3 text-primary" />
              )}
              {!shot.videoUrl && shot.imageUrl && (
                <ImageIcon className="w-3 h-3 text-blue-500" />
              )}
              {!shot.videoUrl && !shot.imageUrl && (
                <FileText className="w-3 h-3 text-muted-foreground/50" />
              )}
            </div>
          </div>
          {shot.visualDescription && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {shot.visualDescription}
            </p>
          )}
        </div>
      </div>

      {/* 右侧：调整时长手柄 */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize",
          "bg-gradient-to-l from-muted/40 to-transparent",
          "hover:from-primary/40 hover:to-transparent",
          isResizing && "from-primary/60 to-transparent"
        )}
        onMouseDown={handleResizeStart}
      >
        <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-muted-foreground/50 rounded-full" />
      </div>
    </div>
  );
}

