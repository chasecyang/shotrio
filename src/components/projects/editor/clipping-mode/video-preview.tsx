"use client";

import { useEditor } from "../editor-context";
import { Spinner } from "@/components/ui/spinner";
import { Film, AlertCircle } from "lucide-react";
import { UseVideoPlaybackReturn } from "@/hooks/use-video-playback";
import { useAudioPlayback } from "@/hooks/use-audio-playback";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TrackStates, DEFAULT_TRACK_STATES } from "@/types/timeline";

interface VideoPreviewProps {
  playback: UseVideoPlaybackReturn;
  trackStates: TrackStates;
}

/**
 * 视频预览组件
 * 使用双缓冲策略实现无缝切换，并同步播放音频轨道
 */
export function VideoPreview({ playback, trackStates }: VideoPreviewProps) {
  const { state } = useEditor();
  const { timeline } = state;

  const {
    videoARef,
    videoBRef,
    activeVideo,
    currentClip,
    isLoading,
    isPlaying,
    currentTime,
  } = playback;

  const [videoError, setVideoError] = useState(false);

  // 音频播放 - 与视频同步
  useAudioPlayback({
    timeline,
    currentTime,
    isPlaying,
    trackStates,
  });

  // 监听视频错误
  useEffect(() => {
    const videoA = videoARef.current;
    const videoB = videoBRef.current;

    const handleError = () => setVideoError(true);
    const handleLoadedData = () => setVideoError(false);

    const setupListeners = (video: HTMLVideoElement | null) => {
      if (!video) return;
      video.addEventListener("error", handleError);
      video.addEventListener("loadeddata", handleLoadedData);
    };

    const cleanupListeners = (video: HTMLVideoElement | null) => {
      if (!video) return;
      video.removeEventListener("error", handleError);
      video.removeEventListener("loadeddata", handleLoadedData);
    };

    setupListeners(videoA);
    setupListeners(videoB);

    return () => {
      cleanupListeners(videoA);
      cleanupListeners(videoB);
    };
  }, [videoARef, videoBRef]);

  // 空状态
  if (!timeline || timeline.clips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-white/60">
        <Film className="w-16 h-16" />
        <p className="text-sm">将素材拖入时间轴开始剪辑</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* 预览画面 */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* 双缓冲视频元素 */}
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Video A */}
          <video
            ref={videoARef}
            className={cn(
              "max-w-full max-h-full object-contain absolute",
              activeVideo === "A" ? "opacity-100 z-10" : "opacity-0 z-0"
            )}
            preload="auto"
            playsInline
            muted={false}
          />

          {/* Video B */}
          <video
            ref={videoBRef}
            className={cn(
              "max-w-full max-h-full object-contain absolute",
              activeVideo === "B" ? "opacity-100 z-10" : "opacity-0 z-0"
            )}
            preload="auto"
            playsInline
            muted={false}
          />
        </div>

        {/* 加载指示器 */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
            <Spinner className="w-8 h-8 text-white" />
          </div>
        )}

        {/* 错误提示 */}
        {videoError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 z-20">
            <AlertCircle className="w-12 h-12 text-red-400" />
            <p className="text-sm text-white/80">视频加载失败</p>
          </div>
        )}

        {/* 当前片段信息 */}
        {currentClip && (
          <div className="absolute top-4 left-4 px-3 py-2 rounded-lg bg-black/80 backdrop-blur-sm text-white text-sm z-30">
            <div className="font-medium">{currentClip.asset.name}</div>
            <div className="text-xs text-white/70 mt-1">
              片段 {timeline.clips.findIndex((c) => c.id === currentClip.id) + 1} / {timeline.clips.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
