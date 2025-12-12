"use client";

import { ShotDetail } from "@/types/project";
import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoTrack } from "./video-track";
import { AudioTrack } from "./audio-track";
import { SubtitleTrack } from "./subtitle-track";

interface TimelineTracksProps {
  shots: ShotDetail[];
  selectedShotIds: string[];
  onSelectionChange: (shotIds: string[]) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  playhead: number;
  onPlayheadChange: (time: number) => void;
  isPlaying: boolean;
}

export function TimelineTracks({
  shots,
  selectedShotIds,
  onSelectionChange,
  zoom,
  onZoomChange,
  playhead,
  onPlayheadChange,
}: TimelineTracksProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 计算总时长（毫秒）
  const totalDuration = shots.reduce((sum, shot) => sum + (shot.duration || 0), 0);
  
  // 像素每毫秒（基础缩放：1秒 = 100px）
  const pixelsPerMs = (100 / 1000) * zoom;

  // 总宽度
  const totalWidth = totalDuration * pixelsPerMs;

  // 时间刻度（每5秒一个刻度）
  const timeMarkers = [];
  const markerInterval = 5000; // 5秒
  for (let time = 0; time <= totalDuration; time += markerInterval) {
    timeMarkers.push(time);
  }

  const formatTimeCode = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleZoomIn = () => {
    onZoomChange(Math.min(zoom + 0.5, 5));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(zoom - 0.5, 0.5));
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = x / pixelsPerMs;
    onPlayheadChange(time);
  };

  return (
    <div className="h-64 border-t border-border bg-background flex flex-col">
      {/* 工具栏 */}
      <div className="h-10 border-b border-border px-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground font-['JetBrains_Mono']">
          时间轴 {formatTimeCode(totalDuration)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="h-7 px-2"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground font-['JetBrains_Mono'] min-w-[40px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleZoomIn}
            disabled={zoom >= 5}
            className="h-7 px-2"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 轨道容器 */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <div 
          ref={timelineRef}
          className="relative min-h-full" 
          style={{ minWidth: Math.max(totalWidth, containerRef.current?.clientWidth || 0) }}
          onClick={handleTimelineClick}
        >
          {/* 时间刻度 */}
          <div className="h-8 border-b border-border bg-muted/30 relative">
            {timeMarkers.map((time) => (
              <div
                key={time}
                className="absolute top-0 bottom-0 flex flex-col items-center"
                style={{ left: time * pixelsPerMs }}
              >
                <div className="w-px h-2 bg-border" />
                <span className="text-xs text-muted-foreground font-['JetBrains_Mono'] mt-1">
                  {formatTimeCode(time)}
                </span>
              </div>
            ))}
          </div>

          {/* 播放头 */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary pointer-events-none z-50"
            style={{ left: playhead * pixelsPerMs }}
          >
            <div className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-primary border-2 border-background shadow-lg" />
          </div>

          {/* 视频轨道 */}
          <VideoTrack
            shots={shots}
            selectedShotIds={selectedShotIds}
            onSelectionChange={onSelectionChange}
            pixelsPerMs={pixelsPerMs}
          />

          {/* 音频轨道 */}
          <AudioTrack
            shots={shots}
            pixelsPerMs={pixelsPerMs}
          />

          {/* 字幕轨道 */}
          <SubtitleTrack
            shots={shots}
            pixelsPerMs={pixelsPerMs}
          />
        </div>
      </div>
    </div>
  );
}
