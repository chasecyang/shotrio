import { useRef, useState, useEffect, useCallback } from "react";
import { TimelineDetail, TimelineClipWithAsset } from "@/types/timeline";
import { findClipAtTime, getNextClip } from "@/lib/utils/timeline-utils";

interface UseVideoPlaybackOptions {
  timeline: TimelineDetail | null;
  onTimeUpdate?: (currentTime: number) => void;
}

export interface UseVideoPlaybackReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  nextVideoRef: React.RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  currentTime: number;
  currentClip: TimelineClipWithAsset | null;
  videoTime: number;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seekTo: (time: number) => void;
  isLoading: boolean;
}

/**
 * 视频播放控制 Hook
 * 处理时间轴播放、片段切换、视频同步等逻辑
 */
export function useVideoPlayback({
  timeline,
  onTimeUpdate,
}: UseVideoPlaybackOptions): UseVideoPlaybackReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 计算当前片段
  const clipInfo = timeline
    ? findClipAtTime(timeline, currentTime)
    : { clip: null, clipStartTime: 0, videoTime: 0 };

  const { clip: currentClip, videoTime } = clipInfo;

  // 更新视频播放位置
  const updateVideoTime = useCallback(() => {
    if (!videoRef.current || !currentClip) return;

    const targetTime = videoTime;
    const currentVideoTime = videoRef.current.currentTime;

    // 如果时间差异较大（超过0.1秒），需要跳转
    if (Math.abs(currentVideoTime - targetTime) > 0.1) {
      videoRef.current.currentTime = targetTime;
    }
  }, [currentClip, videoTime]);

  // 播放循环
  const playbackLoop = useCallback((timestamp: number) => {
    if (!timeline || !isPlaying) return;

    // 首次调用时初始化时间戳
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
      animationFrameRef.current = requestAnimationFrame(playbackLoop);
      return;
    }

    // 计算实际经过的时间（毫秒）
    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    // 更新时间轴时间
    const newTime = currentTime + deltaTime;
    
    if (newTime >= timeline.duration) {
      // 播放结束 - 保持在最后一个有效帧，而不是 duration
      setIsPlaying(false);
      // 设置为 duration - 1ms，确保仍在最后一个片段范围内
      const endTime = Math.max(0, timeline.duration - 1);
      setCurrentTime(endTime);
      onTimeUpdate?.(endTime);
      lastTimeRef.current = 0;
      return;
    }

    setCurrentTime(newTime);
    onTimeUpdate?.(newTime);

    // 继续下一帧
    animationFrameRef.current = requestAnimationFrame(playbackLoop);
  }, [timeline, isPlaying, currentTime, onTimeUpdate]);

  // 播放控制
  const play = useCallback(() => {
    if (!timeline || timeline.clips.length === 0) return;
    
    // 如果已经播放到结尾（接近 duration 的 100ms 内），重新从头开始
    if (currentTime >= timeline.duration - 100) {
      setCurrentTime(0);
      onTimeUpdate?.(0);
    }
    
    // 重置时间戳以避免时间跳跃
    lastTimeRef.current = 0;
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.error("视频播放失败:", err);
        setIsPlaying(false);
      });
    }
  }, [timeline, currentTime, onTimeUpdate]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    lastTimeRef.current = 0;
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seekTo = useCallback((time: number) => {
    if (!timeline) return;
    const clampedTime = Math.max(0, Math.min(time, timeline.duration));
    setCurrentTime(clampedTime);
    onTimeUpdate?.(clampedTime);
  }, [timeline, onTimeUpdate]);

  // 当播放状态改变时，启动或停止播放循环
  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(playbackLoop);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, playbackLoop]);

  // 当当前片段改变时，更新视频源和播放位置
  useEffect(() => {
    updateVideoTime();
  }, [updateVideoTime]);

  // 预加载下一个视频
  useEffect(() => {
    if (!timeline || !currentClip || !nextVideoRef.current) return;

    const nextClip = getNextClip(timeline, currentClip);
    if (nextClip?.asset.videoUrl) {
      nextVideoRef.current.src = nextClip.asset.videoUrl;
      nextVideoRef.current.load();
    }
  }, [timeline, currentClip]);

  // 视频加载状态
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = () => {
      setIsLoading(false);
      console.error("视频加载失败");
    };

    video.addEventListener("loadstart", handleLoadStart);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("loadstart", handleLoadStart);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
    };
  }, []);

  return {
    videoRef,
    nextVideoRef,
    isPlaying,
    currentTime,
    currentClip,
    videoTime,
    play,
    pause,
    togglePlayPause,
    seekTo,
    isLoading,
  };
}

