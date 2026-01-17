"use client";

import { Player } from "@remotion/player";
import { useCallback, useEffect } from "react";
import { z } from "zod";
import { TimelineComposition } from "@/lib/remotion/compositions/TimelineComposition";
import { TimelineCompositionProps } from "@/lib/remotion/types";
import { UseRemotionPlaybackReturn } from "@/hooks/use-remotion-playback";
import { TimelineDetail } from "@/types/timeline";
import { Film, AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface RemotionPreviewProps {
  playback: UseRemotionPlaybackReturn;
  timeline: TimelineDetail | null;
}

/**
 * Remotion 预览组件
 * 使用 Remotion Player 实现帧精确的视频预览
 */
export function RemotionPreview({ playback, timeline }: RemotionPreviewProps) {
  const {
    playerRef,
    compositionProps,
    currentClip,
    handleFrameUpdate,
    handlePlayingChange,
  } = playback;

  // 渲染加载状态
  const renderLoading = useCallback(() => {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black">
        <Spinner className="w-8 h-8 text-white" />
      </div>
    );
  }, []);

  // 渲染错误状态
  const errorFallback = useCallback(({ error }: { error: Error }) => {
    console.error("Remotion Player error:", error);
    return (
      <div className="flex flex-col items-center justify-center gap-2 w-full h-full bg-black">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-sm text-white/80">视频加载失败</p>
      </div>
    );
  }, []);

  // 设置 Player 事件监听
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onFrameUpdate = () => {
      const frame = player.getCurrentFrame();
      handleFrameUpdate(frame);
    };

    const onPlay = () => handlePlayingChange(true);
    const onPause = () => handlePlayingChange(false);

    player.addEventListener("frameupdate", onFrameUpdate);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);

    return () => {
      player.removeEventListener("frameupdate", onFrameUpdate);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
  }, [playerRef, handleFrameUpdate, handlePlayingChange]);

  // 空状态
  if (!timeline || timeline.clips.length === 0 || !compositionProps) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-white/60 h-full">
        <Film className="w-16 h-16" />
        <p className="text-sm">将素材拖入时间轴开始剪辑</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* 预览画面 */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-black">
        <Player<z.ZodTypeAny, TimelineCompositionProps>
          ref={playerRef}
          component={TimelineComposition}
          inputProps={compositionProps}
          durationInFrames={compositionProps.durationInFrames}
          compositionWidth={compositionProps.width}
          compositionHeight={compositionProps.height}
          fps={compositionProps.fps}
          style={{
            width: "100%",
            height: "100%",
          }}
          controls={false}
          spaceKeyToPlayOrPause
          clickToPlay
          renderLoading={renderLoading}
          errorFallback={errorFallback}
        />

        {/* 当前片段信息 */}
        {currentClip && (
          <div className="absolute top-4 left-4 px-3 py-2 rounded-lg bg-black/80 backdrop-blur-sm text-white text-sm z-30">
            <div className="font-medium">{currentClip.asset.name}</div>
            <div className="text-xs text-white/70 mt-1">
              片段{" "}
              {timeline.clips.findIndex((c) => c.id === currentClip.id) + 1} /{" "}
              {timeline.clips.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
