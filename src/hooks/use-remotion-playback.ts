import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { PlayerRef } from "@remotion/player";
import { preloadVideo, preloadAudio } from "@remotion/preload";
import { TimelineDetail, TrackStates, TimelineClipWithAsset } from "@/types/timeline";
import { timelineToRemotionProps } from "@/lib/remotion/transform";
import { TimelineCompositionProps, framesToMs, msToFrames } from "@/lib/remotion/types";

export interface UseRemotionPlaybackOptions {
  timeline: TimelineDetail | null;
  trackStates: TrackStates;
}

export interface UseRemotionPlaybackReturn {
  // Player ref
  playerRef: React.RefObject<PlayerRef | null>;

  // Composition props
  compositionProps: TimelineCompositionProps | null;

  // 状态
  isPlaying: boolean;
  currentClip: TimelineClipWithAsset | null;

  // 时间（毫秒，与旧 API 兼容）
  currentTime: number;
  currentTimeRef: React.RefObject<number>;

  // 控制方法
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (timeMs: number) => void;
  seekDragging: (timeMs: number) => void;

  // 兼容旧 API
  seekTo: (timeMs: number) => void;
  seekToImmediate: (timeMs: number) => void;

  // 帧更新回调（供 RemotionPreview 使用）
  handleFrameUpdate: (frame: number) => void;
  handlePlayingChange: (playing: boolean) => void;
}

/**
 * useRemotionPlayback - Remotion 播放控制 Hook
 * 提供与 usePlayback 兼容的 API
 */
export function useRemotionPlayback({
  timeline,
  trackStates,
}: UseRemotionPlaybackOptions): UseRemotionPlaybackReturn {
  const playerRef = useRef<PlayerRef | null>(null);
  const currentTimeRef = useRef<number>(0);
  const currentClipIdRef = useRef<string | null>(null);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentClip, setCurrentClip] = useState<TimelineClipWithAsset | null>(null);

  const fps = timeline?.fps || 30;

  // 转换 timeline 为 Remotion props
  const compositionProps = useMemo(() => {
    if (!timeline || timeline.clips.length === 0) return null;
    return timelineToRemotionProps(timeline, trackStates);
  }, [timeline, trackStates]);

  // 预加载所有视频和音频资源
  useEffect(() => {
    if (!timeline || timeline.clips.length === 0) return;

    const cleanupFns: (() => void)[] = [];

    // 获取所有唯一的媒体 URL
    const videoUrls = new Set<string>();
    const audioUrls = new Set<string>();

    for (const clip of timeline.clips) {
      if (clip.asset.mediaUrl) {
        const isAudio = clip.trackIndex >= 100;
        if (isAudio) {
          audioUrls.add(clip.asset.mediaUrl);
        } else {
          videoUrls.add(clip.asset.mediaUrl);
        }
      }
    }

    // 预加载所有视频
    for (const url of videoUrls) {
      try {
        const cleanup = preloadVideo(url);
        cleanupFns.push(cleanup);
      } catch {
        // 忽略预加载错误
      }
    }

    // 预加载所有音频
    for (const url of audioUrls) {
      try {
        const cleanup = preloadAudio(url);
        cleanupFns.push(cleanup);
      } catch {
        // 忽略预加载错误
      }
    }

    return () => {
      // 清理预加载
      for (const cleanup of cleanupFns) {
        try {
          cleanup();
        } catch {
          // 忽略清理错误
        }
      }
    };
  }, [timeline]);

  // 根据当前时间查找对应的片段
  const findClipAtTime = useCallback(
    (timeMs: number): TimelineClipWithAsset | null => {
      if (!timeline) return null;

      // 查找视频轨道的片段（trackIndex < 100）
      const videoClips = timeline.clips.filter((c) => c.trackIndex < 100);

      for (const clip of videoClips) {
        const clipEnd = clip.startTime + clip.duration;
        if (timeMs >= clip.startTime && timeMs < clipEnd) {
          return clip;
        }
      }

      return null;
    },
    [timeline]
  );

  // 帧更新回调
  const handleFrameUpdate = useCallback(
    (frame: number) => {
      const timeMs = framesToMs(frame, fps);
      currentTimeRef.current = timeMs;

      // 更新当前片段
      const newClip = findClipAtTime(timeMs);
      if (newClip?.id !== currentClipIdRef.current) {
        currentClipIdRef.current = newClip?.id ?? null;
        setCurrentClip(newClip);
      }

      // 节流更新 currentTime
      if (!throttleTimerRef.current) {
        throttleTimerRef.current = setTimeout(() => {
          setCurrentTime(currentTimeRef.current);
          throttleTimerRef.current = null;
        }, 50);
      }
    },
    [fps, findClipAtTime]
  );

  // 播放状态变化回调
  const handlePlayingChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    if (!playing) {
      // 暂停时同步最终时间
      setCurrentTime(currentTimeRef.current);
    }
  }, []);

  // 控制方法
  const play = useCallback(() => {
    playerRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pause();
    setCurrentTime(currentTimeRef.current);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback(
    (timeMs: number) => {
      const frame = msToFrames(timeMs, fps);
      playerRef.current?.seekTo(frame);
      currentTimeRef.current = timeMs;
      setCurrentTime(timeMs);
      setCurrentClip(findClipAtTime(timeMs));
    },
    [fps, findClipAtTime]
  );

  // 拖拽时的 seek（轻量级，不需要等待）
  const seekDragging = useCallback(
    (timeMs: number) => {
      const frame = msToFrames(timeMs, fps);
      playerRef.current?.seekTo(frame);
      currentTimeRef.current = timeMs;
      // 拖拽时也更新 state 以便 UI 响应
      setCurrentTime(timeMs);
    },
    [fps]
  );

  // 兼容旧 API
  const seekTo = useCallback(
    (timeMs: number) => {
      seekDragging(timeMs);
    },
    [seekDragging]
  );

  const seekToImmediate = useCallback(
    (timeMs: number) => {
      seek(timeMs);
    },
    [seek]
  );

  // 清理
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    };
  }, []);

  return {
    playerRef,
    compositionProps,
    isPlaying,
    currentClip,
    currentTime,
    currentTimeRef,
    play,
    pause,
    togglePlayPause,
    seek,
    seekDragging,
    seekTo,
    seekToImmediate,
    handleFrameUpdate,
    handlePlayingChange,
  };
}
