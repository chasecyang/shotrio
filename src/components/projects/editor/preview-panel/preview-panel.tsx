"use client";

import { useEditor } from "../editor-context";
import { EpisodeEditor } from "./episode-editor";
import { ShotEditor } from "./shot-editor";
import { EmptyPreview } from "./empty-preview";
import { ShotPlaybackPlayer } from "./shot-playback-player";
import { AssetGenerationEditor } from "./asset-generation-editor";
import { AssetDetailEditor } from "./asset-detail-editor";
import { ProjectSettingsEditor } from "./project-settings-editor";

export function PreviewPanel() {
  const { 
    state, 
    selectedEpisode, 
    selectedShot, 
    stopPlayback,
    nextShot,
    previousShot,
    togglePlaybackPause,
  } = useEditor();
  const { selectedResource, playbackState } = state;

  // 如果在播放模式，显示播放器
  if (playbackState.isPlaybackMode) {
    return (
      <ShotPlaybackPlayer
        shots={state.shots}
        currentIndex={playbackState.currentShotIndex}
        isPaused={playbackState.isPaused}
        onNext={nextShot}
        onPrevious={previousShot}
        onTogglePause={togglePlaybackPause}
        onExit={stopPlayback}
      />
    );
  }

  // 根据选中资源类型显示对应编辑器
  if (!selectedResource) {
    return <EmptyPreview />;
  }

  switch (selectedResource.type) {
    case "episode":
      if (selectedEpisode) {
        return <EpisodeEditor episode={selectedEpisode} />;
      }
      break;

    case "shot":
      if (selectedShot) {
        return <ShotEditor shot={selectedShot} />;
      }
      break;

    case "asset-generation":
      if (selectedResource.id) {
        return <AssetGenerationEditor projectId={selectedResource.id} />;
      }
      break;

    case "asset":
      if (selectedResource.id) {
        return <AssetDetailEditor assetId={selectedResource.id} />;
      }
      break;

    case "settings":
      return <ProjectSettingsEditor />;
  }

  return <EmptyPreview />;
}

