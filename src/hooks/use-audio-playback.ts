import { useRef, useEffect, useCallback, useMemo } from "react";
import {
  TimelineDetail,
  TimelineClipWithAsset,
  TrackStates,
  isAudioTrack,
  getTimelineTracks,
} from "@/types/timeline";
import { findAudioClipsAtTime } from "@/lib/utils/timeline-utils";

interface AudioTrackState {
  audioElement: HTMLAudioElement;
  currentClip: TimelineClipWithAsset | null;
}

interface UseAudioPlaybackOptions {
  timeline: TimelineDetail | null;
  currentTime: number;
  isPlaying: boolean;
  trackStates: TrackStates;
}

export interface UseAudioPlaybackReturn {
  audioRefs: React.RefObject<Map<number, HTMLAudioElement>>;
  syncToTime: (time: number) => void;
}

/**
 * 音频播放控制 Hook
 * 管理多个音频轨道的播放，与视频时间同步
 */
export function useAudioPlayback({
  timeline,
  currentTime,
  isPlaying,
  trackStates,
}: UseAudioPlaybackOptions): UseAudioPlaybackReturn {
  // 存储每个轨道的 audio 元素
  const audioRefs = useRef<Map<number, HTMLAudioElement>>(new Map());

  // 存储每个轨道当前播放的片段
  const currentClipsRef = useRef<Map<number, TimelineClipWithAsset | null>>(new Map());

  // 上一次的播放状态
  const lastIsPlayingRef = useRef(false);

  // 从 timeline metadata 动态获取音频轨道索引
  const audioTrackIndices = useMemo(() => {
    if (!timeline) return [];
    const tracks = getTimelineTracks(timeline.metadata);
    return tracks.filter((t) => t.type === "audio").map((t) => t.index);
  }, [timeline?.metadata]);

  // 动态初始化/清理音频元素
  useEffect(() => {
    const audioMap = audioRefs.current;
    const currentIndices = new Set(audioTrackIndices);

    // 为每个音频轨道创建 audio 元素
    audioTrackIndices.forEach((trackIndex) => {
      if (!audioMap.has(trackIndex)) {
        const audio = new Audio();
        audio.preload = "auto";
        audioMap.set(trackIndex, audio);
        currentClipsRef.current.set(trackIndex, null);
      }
    });

    // 清理不再存在的轨道
    audioMap.forEach((audio, trackIndex) => {
      if (!currentIndices.has(trackIndex)) {
        audio.pause();
        audio.src = "";
        audioMap.delete(trackIndex);
        currentClipsRef.current.delete(trackIndex);
      }
    });

    // 清理函数
    return () => {
      audioMap.forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
    };
  }, [audioTrackIndices]);

  // 更新音量和静音状态
  useEffect(() => {
    audioRefs.current.forEach((audio, trackIndex) => {
      const state = trackStates[trackIndex];
      if (state) {
        audio.volume = state.isMuted ? 0 : state.volume;
      }
    });
  }, [trackStates]);

  // 同步到指定时间
  const syncToTime = useCallback(
    (time: number) => {
      if (!timeline) return;

      // 找到所有在当前时间播放的音频片段
      const activeAudioClips = findAudioClipsAtTime(timeline, time);

      // 为每个音频轨道检查并更新
      audioTrackIndices.forEach((trackIndex) => {
        const audio = audioRefs.current.get(trackIndex);
        if (!audio) return;

        const state = trackStates[trackIndex];
        const currentClip = currentClipsRef.current.get(trackIndex);

        // 找到该轨道上正在播放的片段
        const clipForTrack = activeAudioClips.find(
          (c) => c.trackIndex === trackIndex
        );

        if (clipForTrack) {
          // 如果片段变化了，更新音频源
          if (currentClip?.id !== clipForTrack.id) {
            const audioUrl = clipForTrack.asset.audioData?.audioUrl;
            if (audioUrl) {
              audio.src = audioUrl;
              currentClipsRef.current.set(trackIndex, clipForTrack);
            }
          }

          // 计算音频内的播放位置
          const relativeTime = time - clipForTrack.startTime;
          const audioTime = (clipForTrack.trimStart + relativeTime) / 1000;

          // 如果偏差超过 100ms，同步时间
          if (Math.abs(audio.currentTime - audioTime) > 0.1) {
            audio.currentTime = audioTime;
          }

          // 设置音量
          audio.volume = state?.isMuted ? 0 : (state?.volume ?? 1);

          // 如果正在播放且音频暂停了，开始播放
          if (isPlaying && audio.paused && audio.src) {
            audio.play().catch((err) => {
              // 忽略自动播放被阻止的错误
              if (err.name !== "NotAllowedError") {
                console.error(`轨道 ${trackIndex} 音频播放失败:`, err);
              }
            });
          }
        } else {
          // 该轨道当前没有片段，暂停并清除
          if (!audio.paused) {
            audio.pause();
          }
          if (currentClip) {
            currentClipsRef.current.set(trackIndex, null);
          }
        }
      });
    },
    [timeline, isPlaying, trackStates, audioTrackIndices]
  );

  // 当时间变化时同步
  useEffect(() => {
    syncToTime(currentTime);
  }, [currentTime, syncToTime]);

  // 当播放状态变化时
  useEffect(() => {
    if (isPlaying !== lastIsPlayingRef.current) {
      lastIsPlayingRef.current = isPlaying;

      if (!isPlaying) {
        // 暂停所有音频
        audioRefs.current.forEach((audio) => {
          if (!audio.paused) {
            audio.pause();
          }
        });
      } else {
        // 开始播放时同步
        syncToTime(currentTime);
      }
    }
  }, [isPlaying, currentTime, syncToTime]);

  return {
    audioRefs,
    syncToTime,
  };
}
