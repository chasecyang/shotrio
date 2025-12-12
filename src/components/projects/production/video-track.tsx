"use client";

import { ShotDetail } from "@/types/project";
import { cn } from "@/lib/utils";
import { Video, Image as ImageIcon, CheckCircle2 } from "lucide-react";

interface VideoTrackProps {
  shots: ShotDetail[];
  selectedShotIds: string[];
  onSelectionChange: (shotIds: string[]) => void;
  pixelsPerMs: number;
}

export function VideoTrack({
  shots,
  selectedShotIds,
  onSelectionChange,
  pixelsPerMs,
}: VideoTrackProps) {
  let accumulatedTime = 0;

  const handleClipClick = (shotId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (e.shiftKey) {
      // Shift键：切换选择
      if (selectedShotIds.includes(shotId)) {
        onSelectionChange(selectedShotIds.filter((id) => id !== shotId));
      } else {
        onSelectionChange([...selectedShotIds, shotId]);
      }
    } else {
      // 单选
      onSelectionChange([shotId]);
    }
  };

  return (
    <div className="border-b border-border bg-background">
      {/* 轨道标签 */}
      <div className="h-8 px-4 flex items-center border-b border-border bg-muted/30">
        <Video className="w-4 h-4 text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground font-['JetBrains_Mono']">视频</span>
      </div>

      {/* 轨道内容 */}
      <div className="relative h-20">
        {shots.map((shot) => {
          const startTime = accumulatedTime;
          const duration = shot.duration || 3000;
          const width = duration * pixelsPerMs;
          accumulatedTime += duration;

          const isSelected = selectedShotIds.includes(shot.id);
          const hasVideo = !!shot.videoUrl;
          const hasImage = !!shot.imageUrl;

          return (
            <div
              key={shot.id}
              className={cn(
                "absolute top-2 h-16 rounded-md border-2 transition-all cursor-pointer overflow-hidden group",
                isSelected
                  ? "border-primary ring-2 ring-primary/50 z-10"
                  : "border-border hover:border-primary/50",
                hasVideo
                  ? "bg-gradient-to-br from-[#10b981]/20 to-[#059669]/20"
                  : hasImage
                  ? "bg-gradient-to-br from-[#f59e0b]/20 to-[#d97706]/20"
                  : "bg-muted"
              )}
              style={{
                left: startTime * pixelsPerMs,
                width: Math.max(width, 40), // 最小宽度40px
              }}
              onClick={(e) => handleClipClick(shot.id, e)}
            >
              {/* 缩略图背景 */}
              {(hasVideo || hasImage) && (
                <div className="absolute inset-0 opacity-30">
                  <img
                    src={shot.videoUrl || shot.imageUrl || ""}
                    alt={`Shot ${shot.order}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* 内容 */}
              <div className="relative h-full p-2 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-['JetBrains_Mono'] font-semibold text-foreground">
                    #{shot.order}
                  </span>
                  {hasVideo && (
                    <CheckCircle2 className="w-3 h-3 text-[#10b981]" />
                  )}
                </div>

                {width > 60 && (
                  <div className="flex-1 flex items-center">
                    {shot.visualDescription && (
                      <p className="text-xs text-foreground/80 line-clamp-2 leading-tight">
                        {shot.visualDescription}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs font-['JetBrains_Mono'] text-muted-foreground">
                    {(duration / 1000).toFixed(1)}s
                  </span>
                  {!hasVideo && hasImage && (
                    <ImageIcon className="w-3 h-3 text-[#f59e0b]" />
                  )}
                </div>
              </div>

              {/* Hover效果 */}
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
