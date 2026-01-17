import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { TimelineDetail, TimelineClipWithAsset, TrackStates } from "@/types/timeline";
import { PlaybackEngine, PlaybackState } from "@/lib/playback";

export interface UsePlaybackOptions {
  timeline: TimelineDetail | null;
  trackStates: TrackStates;
}

export interface UsePlaybackReturn {
  // 状态（会触发重渲染）
  state: PlaybackState;
  isPlaying: boolean;
  isLoading: boolean;
  currentClip: TimelineClipWithAsset | null;

  // 时间（节流更新的 state，用于 UI 显示）
  currentTime: number;
  // 实时时间 ref（用于播放头等高频更新场景，不触发渲染）
  currentTimeRef: React.RefObject<number>;

  // 视频元素引用
  videoARef: React.RefObject<HTMLVideoElement | null>;
  videoBRef: React.RefObject<HTMLVideoElement | null>;
  activeVideo: "A" | "B";

  // 控制方法
  play: () => Promise<void>;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => Promise<void>;
  seekDragging: (time: number) => void;
  seekDragEnd: (time: number) => Promise<void>;

  // 兼容旧 API
  seekTo: (time: number) => void;
  seekToImmediate: (time: number) => void;
}

/**
 * usePlayback - 播放控制 Hook
 * 封装 PlaybackEngine，提供 React-friendly 的 API
 */
export function usePlayback({
  timeline,
  trackStates,
}: UsePlaybackOptions): UsePlaybackReturn {
  // PlaybackEngine 实例
  const engineRef = useRef<PlaybackEngine | null>(null);

  // 视频元素引用
  const videoARef = useRef<HTMLVideoElement | null>(null);
  const videoBRef = useRef<HTMLVideoElement | null>(null);

  // 高频更新的 refs（不触发渲染）
  const currentTimeRef = useRef<number>(0);
  const currentClipRef = useRef<TimelineClipWithAsset | null>(null);
  const activeVideoRef = useRef<"A" | "B">("A");
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // React 状态
  const [state, setState] = useState<PlaybackState>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [activeVideo, setActiveVideo] = useState<"A" | "B">("A");
  const [currentClip, setCurrentClip] = useState<TimelineClipWithAsset | null>(null);

  // 初始化 PlaybackEngine
  useEffect(() => {
    const engine = new PlaybackEngine({
      timeline,
      trackStates,
      onStateChange: (newState) => {
        setState(newState);
      },
      onTimeUpdate: (time) => {
        // 1. 始终更新 ref（零成本）
        currentTimeRef.current = time;

        // 2. 仅在真正变化时更新 clip/activeVideo state
        const newClip = engine?.getCurrentClip() ?? null;
        if (newClip?.id !== currentClipRef.current?.id) {
          currentClipRef.current = newClip;
          setCurrentClip(newClip);
        }

        const newActiveVideo = engine?.getActiveVideoId() ?? "A";
        if (newActiveVideo !== activeVideoRef.current) {
          activeVideoRef.current = newActiveVideo;
          setActiveVideo(newActiveVideo);
        }

        // 3. 节流更新 currentTime（50ms = 20fps，足够 UI 显示）
        if (!throttleTimerRef.current) {
          throttleTimerRef.current = setTimeout(() => {
            setCurrentTime(currentTimeRef.current);
            throttleTimerRef.current = null;
          }, 50);
        }
      },
      onError: (error) => {
        console.error("Playback error:", error);
      },
    });

    engineRef.current = engine;

    // 获取视频元素引用
    const { videoA, videoB } = engine.getVideoElements();
    videoARef.current = videoA;
    videoBRef.current = videoB;

    return () => {
      // 清理节流 timer
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      engine.destroy();
      engineRef.current = null;
    };
  }, []); // 仅在挂载时创建

  // 当 timeline 变化时更新 engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setTimeline(timeline).then(() => {
        // 同步当前片段状态（等待初始化完成）
        if (engineRef.current) {
          setCurrentClip(engineRef.current.getCurrentClip());
        }
      });
    }
  }, [timeline]);

  // 当 trackStates 变化时更新 engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setTrackStates(trackStates);
    }
  }, [trackStates]);

  // 控制方法
  const play = useCallback(async () => {
    await engineRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    // 暂停时强制同步最终时间到 state
    setCurrentTime(currentTimeRef.current);
  }, []);

  const togglePlayPause = useCallback(() => {
    engineRef.current?.togglePlayPause();
  }, []);

  const seek = useCallback(async (time: number) => {
    await engineRef.current?.seek(time);
  }, []);

  const seekDragging = useCallback((time: number) => {
    engineRef.current?.seekDragging(time);
  }, []);

  const seekDragEnd = useCallback(async (time: number) => {
    await engineRef.current?.seekDragEnd(time);
  }, []);

  // 兼容旧 API
  const seekTo = useCallback((time: number) => {
    engineRef.current?.seekDragging(time);
  }, []);

  const seekToImmediate = useCallback((time: number) => {
    engineRef.current?.seekDragEnd(time);
  }, []);

  // 派生状态
  const isPlaying = state === "playing";
  const isLoading = state === "loading" || state === "seeking";

  return {
    state,
    isPlaying,
    isLoading,
    currentClip,
    currentTime,
    currentTimeRef,
    videoARef,
    videoBRef,
    activeVideo,
    play,
    pause,
    togglePlayPause,
    seek,
    seekDragging,
    seekDragEnd,
    seekTo,
    seekToImmediate,
  };
}
