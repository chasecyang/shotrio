"use client";

import { useRef } from "react";
import { useEditor } from "../editor-context";
import { cn } from "@/lib/utils";

interface TimelineRulerProps {
  totalDuration: number; // 总时长（毫秒）
}

export function TimelineRuler({ totalDuration }: TimelineRulerProps) {
  const { state, setPlayhead } = useEditor();
  const { timeline } = state;
  const rulerRef = useRef<HTMLDivElement>(null);

  // 每个刻度代表的时间（毫秒）
  const getTickInterval = () => {
    if (timeline.zoom >= 2) return 1000; // 1秒
    if (timeline.zoom >= 1) return 2000; // 2秒
    return 5000; // 5秒
  };

  const tickInterval = getTickInterval();
  const pixelsPerMs = 0.1 * timeline.zoom; // 每毫秒的像素数

  // 显示的总时长（至少显示30秒）
  const displayDuration = Math.max(totalDuration, 30000);
  const totalWidth = displayDuration * pixelsPerMs;

  // 生成刻度
  const ticks = [];
  for (let time = 0; time <= displayDuration; time += tickInterval) {
    const isMajor = time % (tickInterval * 5) === 0;
    ticks.push({ time, isMajor });
  }

  // 格式化时间
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  // 点击刻度尺移动播放头
  const handleClick = (e: React.MouseEvent) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + rulerRef.current.scrollLeft;
    const time = x / pixelsPerMs;
    setPlayhead(Math.max(0, Math.min(time, totalDuration)));
  };

  // 播放头位置
  const playheadPosition = timeline.playhead * pixelsPerMs;

  return (
    <div
      ref={rulerRef}
      className="h-8 border-b border-border overflow-x-auto overflow-y-hidden relative cursor-pointer select-none bg-muted/20"
      onClick={handleClick}
    >
      <div
        className="h-full relative"
        style={{ width: `${totalWidth}px`, minWidth: "100%" }}
      >
        {/* 刻度线和时间标签 */}
        {ticks.map(({ time, isMajor }) => (
          <div
            key={time}
            className="absolute top-0 h-full flex flex-col items-center"
            style={{ left: `${time * pixelsPerMs}px` }}
          >
            <div
              className={cn(
                "w-px bg-border",
                isMajor ? "h-full" : "h-2"
              )}
            />
            {isMajor && (
              <span className="absolute top-2 text-xs text-muted-foreground font-mono">
                {formatTime(time)}
              </span>
            )}
          </div>
        ))}

        {/* 播放头指示器 */}
        <div
          className="absolute top-0 h-full w-0.5 bg-primary z-10 transition-[left] duration-75"
          style={{ left: `${playheadPosition}px` }}
        >
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rotate-45 rounded-sm" />
        </div>
      </div>
    </div>
  );
}

