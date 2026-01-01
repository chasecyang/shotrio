"use client";

import { useEditor } from "../editor-context";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Play, Pause, SkipBack, SkipForward, Film, AlertCircle } from "lucide-react";
import { useVideoPlayback } from "@/hooks/use-video-playback";
import { formatTimeDisplay } from "@/lib/utils/timeline-utils";
import { useEffect, useState } from "react";

/**
 * 视频预览组件
 * 实现时间轴的实时视频预览和播放控制
 */
export function VideoPreview() {
  const { state } = useEditor();
  const { timeline } = state;

  const {
    videoRef,
    nextVideoRef,
    isPlaying,
    currentTime,
    currentClip,
    videoTime,
    togglePlayPause,
    seekTo,
    isLoading,
  } = useVideoPlayback({ timeline });

  const [videoError, setVideoError] = useState(false);
  const duration = timeline?.duration || 0;

  // 跳转到上一个片段
  const skipToPrevious = () => {
    if (!timeline || !currentClip) return;
    const currentIndex = timeline.clips.findIndex((c) => c.id === currentClip.id);
    if (currentIndex > 0) {
      const prevClip = timeline.clips[currentIndex - 1];
      seekTo(prevClip.startTime);
    } else {
      seekTo(0);
    }
  };

  // 跳转到下一个片段
  const skipToNext = () => {
    if (!timeline || !currentClip) return;
    const currentIndex = timeline.clips.findIndex((c) => c.id === currentClip.id);
    if (currentIndex < timeline.clips.length - 1) {
      const nextClip = timeline.clips[currentIndex + 1];
      seekTo(nextClip.startTime);
    }
  };

  // 进度条拖拽
  const handleSeek = (value: number[]) => {
    seekTo(value[0]);
  };

  // 监听视频错误
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleError = () => setVideoError(true);
    const handleLoadedData = () => setVideoError(false);

    video.addEventListener("error", handleError);
    video.addEventListener("loadeddata", handleLoadedData);

    return () => {
      video.removeEventListener("error", handleError);
      video.removeEventListener("loadeddata", handleLoadedData);
    };
  }, [videoRef]);

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
        {/* 主视频元素 */}
        {currentClip?.asset.videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={currentClip.asset.videoUrl}
              className="max-w-full max-h-full object-contain"
              onError={() => setVideoError(true)}
              onLoadedData={() => setVideoError(false)}
            />
            {/* 预加载下一个视频（隐藏） */}
            <video
              ref={nextVideoRef}
              className="hidden"
              preload="auto"
            />
          </>
        ) : (
          // 如果没有视频URL，显示缩略图
          <img
            src={
              currentClip?.asset.thumbnailUrl ||
              currentClip?.asset.imageUrl ||
              ""
            }
            alt="预览"
            className="max-w-full max-h-full object-contain"
          />
        )}

        {/* 加载指示器 */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <Spinner className="w-8 h-8 text-white" />
          </div>
        )}

        {/* 错误提示 */}
        {videoError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 z-10">
            <AlertCircle className="w-12 h-12 text-red-400" />
            <p className="text-sm text-white/80">视频加载失败</p>
          </div>
        )}

        {/* 当前片段信息 */}
        {currentClip && (
          <div className="absolute top-4 left-4 px-3 py-2 rounded-lg bg-black/80 backdrop-blur-sm text-white text-sm z-10">
            <div className="font-medium">{currentClip.asset.name}</div>
            <div className="text-xs text-white/70 mt-1">
              片段 {timeline.clips.findIndex((c) => c.id === currentClip.id) + 1} / {timeline.clips.length}
            </div>
          </div>
        )}
      </div>

      {/* 播放控制栏 - 增强视觉对比 */}
      <div className="shrink-0 p-4 bg-zinc-900/95 backdrop-blur-md border-t border-white/10 space-y-3">
        {/* 进度条 */}
        <div className="space-y-2">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={100}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-zinc-400">
            <span>{formatTimeDisplay(currentTime)}</span>
            <span>{formatTimeDisplay(duration)}</span>
          </div>
        </div>

        {/* 控制按钮 - 增强可见性 */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 text-zinc-300 hover:text-white hover:bg-white/15 transition-all"
            onClick={skipToPrevious}
            disabled={!currentClip}
          >
            <SkipBack className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="h-14 w-14 p-0 text-white hover:text-white hover:bg-white/25 hover:scale-105 rounded-full transition-all shadow-lg bg-white/10"
            onClick={togglePlayPause}
            disabled={!currentClip}
          >
            {isPlaying ? (
              <Pause className="h-7 w-7" />
            ) : (
              <Play className="h-7 w-7 ml-0.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 text-zinc-300 hover:text-white hover:bg-white/15 transition-all"
            onClick={skipToNext}
            disabled={!currentClip}
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        {/* 视频时间信息 */}
        {currentClip?.asset.videoUrl && (
          <div className="text-center text-xs text-zinc-500">
            视频时间: {formatTimeDisplay(videoTime)}
          </div>
        )}
      </div>
    </div>
  );
}

