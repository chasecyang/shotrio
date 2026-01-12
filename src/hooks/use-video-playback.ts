import { useRef, useState, useEffect, useCallback } from "react";
import { TimelineDetail, TimelineClipWithAsset } from "@/types/timeline";
import { findClipAtTime, getNextClip } from "@/lib/utils/timeline-utils";

interface UseVideoPlaybackOptions {
  timeline: TimelineDetail | null;
  onTimeUpdate?: (currentTime: number) => void;
}

export interface UseVideoPlaybackReturn {
  videoARef: React.RefObject<HTMLVideoElement | null>;
  videoBRef: React.RefObject<HTMLVideoElement | null>;
  activeVideo: "A" | "B";
  isPlaying: boolean;
  currentTime: number;
  currentClip: TimelineClipWithAsset | null;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seekTo: (time: number) => void;
  isLoading: boolean;
}

/**
 * 视频播放控制 Hook
 * 使用双缓冲策略实现无缝切换，视频驱动时间轴
 */
export function useVideoPlayback({
  timeline,
  onTimeUpdate,
}: UseVideoPlaybackOptions): UseVideoPlaybackReturn {
  // 双缓冲 video 引用
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);

  // 当前活跃的 video（A 或 B）
  const [activeVideo, setActiveVideo] = useState<"A" | "B">("A");

  // 播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // refs 用于避免闭包陷阱
  const currentTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const pendingClipRef = useRef<TimelineClipWithAsset | null>(null);
  const currentClipRef = useRef<TimelineClipWithAsset | null>(null);

  // 计算当前片段
  const clipInfo = timeline
    ? findClipAtTime(timeline, currentTime)
    : { clip: null, clipStartTime: 0, videoTime: 0 };

  const { clip: currentClip } = clipInfo;

  // 更新 currentClipRef
  useEffect(() => {
    currentClipRef.current = currentClip;
  }, [currentClip]);

  // 获取当前活跃的 video 元素
  const getActiveVideo = useCallback(() => {
    return activeVideo === "A" ? videoARef.current : videoBRef.current;
  }, [activeVideo]);

  // 获取备用的 video 元素
  const getInactiveVideo = useCallback(() => {
    return activeVideo === "A" ? videoBRef.current : videoARef.current;
  }, [activeVideo]);

  // 暂停播放
  const pause = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    const video = getActiveVideo();
    if (video) {
      video.pause();
    }
  }, [getActiveVideo]);

  // 切换到下一个片段
  const switchToNextClip = useCallback(() => {
    const nextClip = pendingClipRef.current;
    if (!nextClip) {
      // 没有下一片段，停止播放
      pause();
      return;
    }

    const currentVideo = getActiveVideo();
    const nextVideo = getInactiveVideo();

    if (!currentVideo || !nextVideo) return;

    // 更新当前片段引用
    currentClipRef.current = nextClip;

    // 开始播放预加载的视频
    nextVideo
      .play()
      .then(() => {
        // 切换活跃视频
        setActiveVideo((prev) => (prev === "A" ? "B" : "A"));
        // 停止旧视频
        currentVideo.pause();
        // 清除 pending
        pendingClipRef.current = null;
      })
      .catch((err) => {
        console.error("切换视频失败:", err);
      });
  }, [getActiveVideo, getInactiveVideo, pause]);

  // 预加载下一片段
  const prepareNextClip = useCallback(() => {
    if (!timeline || !currentClipRef.current) return;

    const nextClip = getNextClip(timeline, currentClipRef.current);
    if (!nextClip) {
      pendingClipRef.current = null;
      return;
    }

    const inactiveVideo = getInactiveVideo();
    if (!inactiveVideo || !nextClip.asset.mediaUrl) return;

    // 检查是否已经预加载了这个片段
    if (pendingClipRef.current?.id === nextClip.id) return;

    // 设置预加载视频
    inactiveVideo.src = nextClip.asset.mediaUrl;
    inactiveVideo.currentTime = nextClip.trimStart / 1000;
    inactiveVideo.load();
    pendingClipRef.current = nextClip;
  }, [timeline, getInactiveVideo]);

  // 视频 timeupdate 事件处理 - 驱动时间轴
  useEffect(() => {
    const video = getActiveVideo();
    if (!video || !timeline) return;

    const handleTimeUpdate = () => {
      if (!isPlayingRef.current || !currentClipRef.current) return;

      const clip = currentClipRef.current;
      // 从视频当前时间反算时间轴时间
      const videoCurrentTimeMs = video.currentTime * 1000;
      const timelineTime = clip.startTime + (videoCurrentTimeMs - clip.trimStart);

      // 检测是否到达片段结尾
      const clipEndVideoTime = (clip.trimStart + clip.duration) / 1000;
      if (video.currentTime >= clipEndVideoTime - 0.05) {
        // 切换到下一片段
        switchToNextClip();
      } else {
        currentTimeRef.current = timelineTime;
        setCurrentTime(timelineTime);
        onTimeUpdate?.(timelineTime);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [activeVideo, timeline, onTimeUpdate, getActiveVideo, switchToNextClip]);

  // 当片段变化或视频切换时，预加载下一个
  useEffect(() => {
    if (currentClipRef.current && isPlayingRef.current) {
      prepareNextClip();
    }
  }, [currentClip, activeVideo, prepareNextClip]);

  // 开始播放
  const play = useCallback(() => {
    if (!timeline || timeline.clips.length === 0) return;

    const video = getActiveVideo();
    if (!video) return;

    // 如果已经播放到结尾，重新从头开始
    if (currentTimeRef.current >= timeline.duration - 100) {
      const firstClip = timeline.clips[0];
      if (firstClip?.asset.mediaUrl) {
        video.src = firstClip.asset.mediaUrl;
        video.currentTime = firstClip.trimStart / 1000;
        currentTimeRef.current = 0;
        setCurrentTime(0);
        onTimeUpdate?.(0);
        currentClipRef.current = firstClip;
      }
    } else if (!currentClip) {
      // 如果没有当前片段，初始化第一个
      const firstClip = timeline.clips[0];
      if (firstClip?.asset.mediaUrl) {
        video.src = firstClip.asset.mediaUrl;
        video.currentTime = firstClip.trimStart / 1000;
        currentClipRef.current = firstClip;
      }
    } else if (!video.src || video.src !== currentClip.asset.mediaUrl) {
      // 确保当前视频源正确
      if (currentClip.asset.mediaUrl) {
        video.src = currentClip.asset.mediaUrl;
        const { videoTime } = findClipAtTime(timeline, currentTimeRef.current);
        video.currentTime = videoTime;
      }
    }

    isPlayingRef.current = true;
    setIsPlaying(true);

    video.play().then(() => {
      // 播放成功后立即预加载下一个片段
      prepareNextClip();
    }).catch((err) => {
      console.error("视频播放失败:", err);
      isPlayingRef.current = false;
      setIsPlaying(false);
    });
  }, [timeline, currentClip, getActiveVideo, onTimeUpdate, prepareNextClip]);

  // 切换播放/暂停
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  // 跳转到指定时间
  const seekTo = useCallback(
    (time: number) => {
      if (!timeline) return;

      const clampedTime = Math.max(0, Math.min(time, timeline.duration));
      const { clip, videoTime } = findClipAtTime(timeline, clampedTime);

      if (!clip) return;

      const video = getActiveVideo();
      if (!video) return;

      // 如果跳转到不同片段，需要切换视频源
      if (clip.id !== currentClipRef.current?.id) {
        setIsLoading(true);
        video.src = clip.asset.mediaUrl || "";
        video.onloadeddata = () => {
          video.currentTime = videoTime;
          video.onloadeddata = null;
          setIsLoading(false);
          // 预加载下一个片段
          currentClipRef.current = clip;
          prepareNextClip();
        };
        video.load();
      } else {
        // 同一片段内跳转
        video.currentTime = videoTime;
      }

      currentTimeRef.current = clampedTime;
      setCurrentTime(clampedTime);
      onTimeUpdate?.(clampedTime);
    },
    [timeline, getActiveVideo, onTimeUpdate, prepareNextClip]
  );

  // 监听视频加载状态
  useEffect(() => {
    const videoA = videoARef.current;
    const videoB = videoBRef.current;

    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = (e: Event) => {
      setIsLoading(false);
      console.error("视频加载失败:", e);
    };

    const setupListeners = (video: HTMLVideoElement | null) => {
      if (!video) return;
      video.addEventListener("loadstart", handleLoadStart);
      video.addEventListener("canplay", handleCanPlay);
      video.addEventListener("error", handleError);
    };

    const cleanupListeners = (video: HTMLVideoElement | null) => {
      if (!video) return;
      video.removeEventListener("loadstart", handleLoadStart);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
    };

    setupListeners(videoA);
    setupListeners(videoB);

    return () => {
      cleanupListeners(videoA);
      cleanupListeners(videoB);
    };
  }, []);

  return {
    videoARef,
    videoBRef,
    activeVideo,
    isPlaying,
    currentTime,
    currentClip,
    play,
    pause,
    togglePlayPause,
    seekTo,
    isLoading,
  };
}
