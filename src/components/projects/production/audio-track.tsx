"use client";

import { ShotDetail } from "@/types/project";
import { Music } from "lucide-react";

interface AudioTrackProps {
  shots: ShotDetail[];
  pixelsPerMs: number;
}

export function AudioTrack({ shots, pixelsPerMs }: AudioTrackProps) {
  let accumulatedTime = 0;

  return (
    <div className="border-b border-border bg-background">
      {/* 轨道标签 */}
      <div className="h-8 px-4 flex items-center border-b border-border bg-muted/30">
        <Music className="w-4 h-4 text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground font-['JetBrains_Mono']">音频</span>
      </div>

      {/* 轨道内容 */}
      <div className="relative h-16">
        {shots.map((shot) => {
          const startTime = accumulatedTime;
          const duration = shot.duration || 3000;
          const width = duration * pixelsPerMs;
          accumulatedTime += duration;

          // 如果分镜有对话，显示音频波形占位
          const hasDialogues = shot.dialogues && shot.dialogues.length > 0;

          return hasDialogues ? (
            <div
              key={shot.id}
              className="absolute top-2 h-12 rounded border border-border bg-gradient-to-br from-[#6366f1]/10 to-[#4f46e5]/10"
              style={{
                left: startTime * pixelsPerMs,
                width: Math.max(width, 40),
              }}
            >
              {/* 音频波形可视化占位 */}
              <div className="h-full px-2 flex items-center gap-0.5">
                {Array.from({ length: Math.floor(width / 3) }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-[#6366f1]/40 rounded-full"
                    style={{
                      height: `${20 + Math.random() * 60}%`,
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
}
