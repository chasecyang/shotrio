"use client";

import { ShotDetail } from "@/types/project";
import { MessageSquare } from "lucide-react";

interface SubtitleTrackProps {
  shots: ShotDetail[];
  pixelsPerMs: number;
}

export function SubtitleTrack({ shots, pixelsPerMs }: SubtitleTrackProps) {
  let accumulatedTime = 0;

  return (
    <div className="border-b border-border bg-background">
      {/* 轨道标签 */}
      <div className="h-8 px-4 flex items-center border-b border-border bg-muted/30">
        <MessageSquare className="w-4 h-4 text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground font-['JetBrains_Mono']">字幕</span>
      </div>

      {/* 轨道内容 */}
      <div className="relative h-12">
        {shots.map((shot) => {
          const startTime = accumulatedTime;
          const duration = shot.duration || 3000;
          const width = duration * pixelsPerMs;
          accumulatedTime += duration;

          return (
            <div key={shot.id} className="absolute top-0 h-full" style={{ left: startTime * pixelsPerMs, width }}>
              {shot.dialogues.map((dialogue, idx) => {
                // 简单均分对话时间
                const dialogueDuration = duration / shot.dialogues.length;
                const dialogueStart = idx * dialogueDuration;
                const dialogueWidth = dialogueDuration * pixelsPerMs;

                return (
                  <div
                    key={dialogue.id}
                    className="absolute top-2 h-8 rounded border border-border bg-gradient-to-r from-[#ec4899]/10 to-[#db2777]/10 px-2 flex items-center overflow-hidden"
                    style={{
                      left: dialogueStart * pixelsPerMs,
                      width: Math.max(dialogueWidth, 30),
                    }}
                  >
                    <span className="text-xs text-foreground/70 truncate font-['JetBrains_Mono']">
                      {dialogue.dialogueText}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
