"use client";

import { useEditor } from "../editor-context";
import { EpisodeEditor } from "./episode-editor";
import { ShotEditor } from "./shot-editor";
import { CharacterDetail } from "./character-detail";
import { SceneDetail } from "./scene-detail";
import { EmptyPreview } from "./empty-preview";
import { ShotPlaybackPlayer } from "./shot-playback-player";

export function PreviewPanel() {
  const { 
    state, 
    selectedEpisode, 
    selectedShot, 
    selectedCharacter, 
    selectedScene,
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

    case "character":
      if (selectedCharacter) {
        return <CharacterDetail character={selectedCharacter} />;
      }
      break;

    case "scene":
      if (selectedScene) {
        return <SceneDetail scene={selectedScene} />;
      }
      break;
  }

  return <EmptyPreview />;
}

