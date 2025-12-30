"use client";

import { useState, useCallback, useMemo } from "react";
import { ShotDetail } from "@/types/project";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Image as ImageIcon, GripVertical, Video, FileText, Clock, Loader2 } from "lucide-react";
import { useEditor } from "../editor-context";
import { formatDuration } from "@/lib/utils/shot-utils";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

interface ShotClipProps {
  shot: ShotDetail;
  isSelected: boolean;
  pixelsPerMs: number;
  onClick: (e: React.MouseEvent) => void;
}

export function ShotClip({ shot, isSelected, pixelsPerMs, onClick }: ShotClipProps) {
  const tToast = useTranslations("toasts");
  const { state, dispatch, jobs } = useEditor();
  const [isResizing, setIsResizing] = useState(false);
  const [originalDuration, setOriginalDuration] = useState(0);

  // 获取第一张关联素材作为缩略图
  const firstAsset = shot.shotAssets?.[0]?.asset;

  const duration = shot.duration || 3000;
  const width = duration * pixelsPerMs;
  const minWidth = 500 * pixelsPerMs; // 最小 0.5 秒

  // 检查当前 shot 是否有视频生成任务
  const videoGenerationStatus = useMemo(() => {
    const activeJob = jobs.find(job => {
      if (job.type !== 'shot_video_generation') return false;
      if (job.status !== 'pending' && job.status !== 'processing') return false;
      
      try {
        const inputData = JSON.parse(job.inputData || '{}');
        return inputData.shotId === shot.id;
      } catch {
        return false;
      }
    });

    if (!activeJob) return null;
    return activeJob.status;
  }, [jobs, shot.id]);

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
              toast.error(tToast("error.updateDurationFailed"));
              // 恢复原始时长
              const restoredShots = state.shots.map((s) =>
                s.id === shot.id ? { ...s, duration: originalDuration } : s
              );
              dispatch({ type: "SET_SHOTS", payload: restoredShots });
            }
          } catch (error) {
            console.error(error);
            toast.error(tToast("error.updateDurationFailed"));
          }
        }
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [duration, originalDuration, pixelsPerMs, shot.id, state.shots, dispatch, tToast]
  );


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
        isResizing && "select-none"
      )}
      onClick={onClick}
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
            {firstAsset?.imageUrl ? (
              <>
                <Image
                  src={firstAsset.imageUrl}
                  alt={`#${shot.order}`}
                  fill
                  className="object-cover"
                />
                {/* 多图片数量徽章 */}
                {shot.shotAssets && shot.shotAssets.length > 1 && (
                  <Badge 
                    variant="secondary"
                    className="absolute top-0.5 left-0.5 h-4 px-1 text-[9px] bg-black/70 text-white border-0"
                  >
                    {shot.shotAssets.length}
                  </Badge>
                )}
                {/* 视频标识 */}
                {shot.currentVideo?.videoUrl && (
                  <div className="absolute bottom-0.5 right-0.5 bg-primary rounded px-1 py-0.5">
                    <Video className="w-2.5 h-2.5 text-primary-foreground" />
                  </div>
                )}
                {/* 视频生成状态徽章 */}
                {videoGenerationStatus && (
                  <div className="absolute top-0.5 left-0.5">
                    <Badge 
                      variant={videoGenerationStatus === 'processing' ? 'default' : 'secondary'}
                      className={cn(
                        "h-4 px-1 text-[9px] gap-0.5",
                        videoGenerationStatus === 'processing' && "bg-blue-500 hover:bg-blue-600",
                        videoGenerationStatus === 'pending' && "bg-yellow-500 hover:bg-yellow-600 text-yellow-950"
                      )}
                    >
                      {videoGenerationStatus === 'processing' ? (
                        <>
                          <Loader2 className="w-2 h-2 animate-spin" />
                          生成中
                        </>
                      ) : (
                        <>
                          <Clock className="w-2 h-2" />
                          排队中
                        </>
                      )}
                    </Badge>
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
              {shot.currentVideo?.videoUrl && (
                <Video className="w-3 h-3 text-primary" />
              )}
              {!shot.currentVideo?.videoUrl && firstAsset?.imageUrl && (
                <ImageIcon className="w-3 h-3 text-blue-500" />
              )}
              {!shot.currentVideo?.videoUrl && !firstAsset?.imageUrl && (
                <FileText className="w-3 h-3 text-muted-foreground/50" />
              )}
            </div>
          </div>
          {shot.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {shot.description}
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

