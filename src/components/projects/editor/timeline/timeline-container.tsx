"use client";

import { useEditor } from "../editor-context";
import { TimelineToolbar } from "./timeline-toolbar";
import { TimelineRuler } from "./timeline-ruler";
import { TimelineTrack } from "./timeline-track";
import { Clapperboard } from "lucide-react";

interface TimelineContainerProps {
  onAddShot?: () => void;
  onDeleteShots?: () => void;
  onGenerateImages?: () => void;
  onGenerateVideos?: () => void;
}

export function TimelineContainer({ 
  onAddShot, 
  onDeleteShots,
  onGenerateImages,
  onGenerateVideos,
}: TimelineContainerProps) {
  const { state, selectedEpisode, totalDuration } = useEditor();
  const { shots, isLoading, selectedEpisodeId } = state;

  if (!selectedEpisodeId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Clapperboard className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">请先选择一个剧集</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <TimelineToolbar 
        episodeTitle={selectedEpisode?.title} 
        onAddShot={onAddShot} 
        onDeleteShots={onDeleteShots}
        onGenerateImages={onGenerateImages}
        onGenerateVideos={onGenerateVideos}
      />

      {/* 时间轴内容 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 时间刻度尺 */}
        <TimelineRuler totalDuration={totalDuration} />

        {/* 分镜轨道 */}
        <TimelineTrack shots={shots} isLoading={isLoading} onAddShot={onAddShot} />
      </div>
    </div>
  );
}

