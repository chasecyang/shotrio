"use client";

import { useEditor } from "../editor-context";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ShotEditor } from "./shot-editor";
import { ShotPlaybackPlayer } from "./shot-playback-player";
import { TimelineContainer } from "../timeline/timeline-container";

interface StoryboardPreviewProps {
  onAddShot?: () => void;
  onDeleteShots?: () => void;
  onGenerateVideos?: () => void;
  onExportVideos?: () => void;
  isExportingVideos?: boolean;
}

export function StoryboardPreview({
  onAddShot,
  onDeleteShots,
  onGenerateVideos,
  onExportVideos,
  isExportingVideos,
}: StoryboardPreviewProps) {
  const {
    state,
    selectedShot,
    stopPlayback,
    nextShot,
    previousShot,
    togglePlaybackPause,
  } = useEditor();
  
  const { playbackState, shots } = state;

  // 上部内容区域渲染逻辑
  const renderTopContent = () => {
    // 1. 播放模式 - 显示视频播放器
    if (playbackState.isPlaybackMode) {
      return (
        <ShotPlaybackPlayer
          shots={shots}
          currentIndex={playbackState.currentShotIndex}
          isPaused={playbackState.isPaused}
          onNext={nextShot}
          onPrevious={previousShot}
          onTogglePause={togglePlaybackPause}
          onExit={stopPlayback}
        />
      );
    }

    // 2. 选中了具体分镜 - 显示分镜编辑器
    if (selectedShot) {
      return <ShotEditor shot={selectedShot} />;
    }

    // 3. 未选中分镜（默认状态）- 显示视频预览
    return (
      <ShotPlaybackPlayer
        shots={shots}
        currentIndex={0}
        isPaused={true}
        onNext={nextShot}
        onPrevious={previousShot}
        onTogglePause={togglePlaybackPause}
        onExit={stopPlayback}
      />
    );
  };

  return (
    <div className="h-full flex flex-col">
      <ResizablePanelGroup direction="vertical" className="h-full">
        {/* 上部：动态内容区（编辑器或预览） */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <div className="h-full overflow-hidden bg-background">
            {renderTopContent()}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 下部：时间轴 */}
        <ResizablePanel defaultSize={40} minSize={20} maxSize={60}>
          <div className="h-full overflow-hidden bg-card/50 backdrop-blur-sm">
            <TimelineContainer
              onAddShot={onAddShot}
              onDeleteShots={onDeleteShots}
              onGenerateVideos={onGenerateVideos}
              onExportVideos={onExportVideos}
              isExportingVideos={isExportingVideos}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

