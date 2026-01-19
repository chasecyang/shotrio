import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { PlayerRef } from "@remotion/player";
import { preloadVideo, preloadAudio } from "@remotion/preload";
import { TimelineDetail, TrackStates } from "@/types/timeline";
import { timelineToRemotionProps } from "@/lib/remotion/transform";
import { TimelineCompositionProps, framesToMs, msToFrames } from "@/lib/remotion/types";

export interface UseRemotionPlaybackOptions {
  timeline: TimelineDetail | null;
  trackStates: TrackStates;
}

export interface UseRemotionPlaybackReturn {
  playerRef: React.RefObject<PlayerRef | null>;
  compositionProps: TimelineCompositionProps | null;
  isPlaying: boolean;
  currentTime: number;
  currentTimeRef: React.RefObject<number>;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (timeMs: number) => void;
  handleFrameUpdate: (frame: number) => void;
  handlePlayingChange: (playing: boolean) => void;
}

/**
 * useRemotionPlayback - Remotion 播放控制 Hook
 */
export function useRemotionPlayback({
  timeline,
  trackStates,
}: UseRemotionPlaybackOptions): UseRemotionPlaybackReturn {
  const playerRef = useRef<PlayerRef | null>(null);
  const currentTimeRef = useRef<number>(0);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const fps = timeline?.fps || 30;

  const compositionProps = useMemo(() => {
    if (!timeline || timeline.clips.length === 0) return null;
    return timelineToRemotionProps(timeline, trackStates);
  }, [timeline, trackStates]);

  // 预加载所有视频和音频资源
  useEffect(() => {
    if (!timeline || timeline.clips.length === 0) return;

    const cleanupFns: (() => void)[] = [];
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

    for (const url of videoUrls) {
      try {
        cleanupFns.push(preloadVideo(url));
      } catch {
        // 忽略预加载错误
      }
    }

    for (const url of audioUrls) {
      try {
        cleanupFns.push(preloadAudio(url));
      } catch {
        // 忽略预加载错误
      }
    }

    return () => {
      for (const cleanup of cleanupFns) {
        try {
          cleanup();
        } catch {
          // 忽略清理错误
        }
      }
    };
  }, [timeline]);

  const handleFrameUpdate = useCallback(
    (frame: number) => {
      const timeMs = framesToMs(frame, fps);
      currentTimeRef.current = timeMs;

      if (!throttleTimerRef.current) {
        throttleTimerRef.current = setTimeout(() => {
          setCurrentTime(currentTimeRef.current);
          throttleTimerRef.current = null;
        }, 50);
      }
    },
    [fps]
  );

  const handlePlayingChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    if (!playing) {
      setCurrentTime(currentTimeRef.current);
    }
  }, []);

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
    },
    [fps]
  );

  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, []);

  return {
    playerRef,
    compositionProps,
    isPlaying,
    currentTime,
    currentTimeRef,
    play,
    pause,
    togglePlayPause,
    seek,
    handleFrameUpdate,
    handlePlayingChange,
  };
}
