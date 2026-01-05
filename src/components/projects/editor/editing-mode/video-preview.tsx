"use client";

import { useEditor } from "../editor-context";
import { Spinner } from "@/components/ui/spinner";
import { Film, AlertCircle } from "lucide-react";
import { UseVideoPlaybackReturn } from "@/hooks/use-video-playback";
import { useEffect, useState } from "react";

interface VideoPreviewProps {
  playback: UseVideoPlaybackReturn;
}

/**
 * 视频预览组件
 * 实现时间轴的实时视频预览
 */
export function VideoPreview({ playback }: VideoPreviewProps) {
  const { state } = useEditor();
  const { timeline } = state;

  const {
    videoRef,
    nextVideoRef,
    currentClip,
    isLoading,
  } = playback;

  const [videoError, setVideoError] = useState(false);

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
        {currentClip?.asset.mediaUrl ? (
          <>
            <video
              ref={videoRef}
              src={currentClip.asset.mediaUrl}
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
        ) : currentClip?.asset.displayUrl ? (
          // 如果没有视频URL但有缩略图，显示缩略图
          <img
            src={currentClip.asset.displayUrl}
            alt="预览"
            className="max-w-full max-h-full object-contain"
            onError={() => setVideoError(true)}
          />
        ) : (
          // 如果没有任何可显示的内容，显示占位符
          <div className="flex flex-col items-center justify-center gap-4 text-white/40">
            <Film className="w-12 h-12" />
            <p className="text-sm">无可用预览</p>
          </div>
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
    </div>
  );
}

