import { TimelineDetail, TimelineClipWithAsset, TrackStates } from "@/types/timeline";

// 播放状态
export type PlaybackState =
  | "idle" // 初始状态，无时间轴
  | "loading" // 正在加载第一个片段
  | "ready" // 已加载，可以播放
  | "playing" // 正在播放
  | "paused" // 已暂停
  | "seeking" // 正在跳转
  | "error"; // 错误状态

// 播放事件
export type PlaybackEvent =
  | { type: "LOAD_TIMELINE"; timeline: TimelineDetail }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "SEEK"; time: number }
  | { type: "SEEK_COMPLETE" }
  | { type: "CLIP_END" }
  | { type: "LOAD_SUCCESS" }
  | { type: "LOAD_ERROR"; error: Error }
  | { type: "RESET" };

// 状态转换表
export const STATE_TRANSITIONS: Record<
  PlaybackState,
  Partial<Record<PlaybackEvent["type"], PlaybackState>>
> = {
  idle: {
    LOAD_TIMELINE: "loading",
  },
  loading: {
    LOAD_SUCCESS: "ready",
    LOAD_ERROR: "error",
    RESET: "idle",
  },
  ready: {
    PLAY: "playing",
    SEEK: "seeking",
    RESET: "idle",
  },
  playing: {
    PAUSE: "paused",
    SEEK: "seeking",
    CLIP_END: "playing", // 无缝切换，保持播放
    RESET: "idle",
  },
  paused: {
    PLAY: "playing",
    SEEK: "seeking",
    RESET: "idle",
  },
  seeking: {
    SEEK_COMPLETE: "paused", // seek 完成后默认暂停
    PLAY: "playing", // seek 后继续播放
    LOAD_ERROR: "error",
    RESET: "idle",
  },
  error: {
    RESET: "idle",
    LOAD_TIMELINE: "loading",
  },
};

// 时间更新回调
export type TimeUpdateCallback = (time: number) => void;

// 状态变化回调
export type StateChangeCallback = (state: PlaybackState) => void;

// PlaybackEngine 配置
export interface PlaybackEngineConfig {
  timeline: TimelineDetail | null;
  trackStates: TrackStates;
  onStateChange?: StateChangeCallback;
  onTimeUpdate?: TimeUpdateCallback;
  onError?: (error: Error) => void;
}

// VideoController 配置
export interface VideoControllerConfig {
  onTimeUpdate?: (time: number) => void; // 可选，被动模式下不使用
  onClipEnd?: () => void; // 可选，被动模式下不使用
  onError: (error: Error) => void;
}

// AudioController 配置
export interface AudioControllerConfig {
  trackStates: TrackStates;
  onError: (trackIndex: number, error: Error) => void;
}

// 加载超时时间 (毫秒)
export const LOAD_TIMEOUT = 5000;

// 同步阈值 (秒)
export const SYNC_THRESHOLDS = {
  IGNORE: 0.05, // < 50ms: 忽略
  SOFT_CORRECT: 0.3, // 50-300ms: 调整 playbackRate
  HARD_SEEK: 0.5, // > 500ms: 硬跳转
};

/**
 * 通用的媒体加载超时函数
 * @param media 媒体元素 (HTMLVideoElement | HTMLAudioElement)
 * @param src 媒体源 URL
 * @param startTime 开始时间
 * @param mediaType 媒体类型标识，用于错误消息
 * @param timeout 超时时间
 */
export async function loadMediaWithTimeout(
  media: HTMLMediaElement,
  src: string,
  startTime: number,
  mediaType: "视频" | "音频",
  timeout: number = LOAD_TIMEOUT
): Promise<void> {
  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      media.removeEventListener("canplay", onReady);
      media.removeEventListener("error", onError);
    };

    const onReady = () => {
      cleanup();
      media.currentTime = startTime;
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error(`${mediaType}加载失败`));
    };

    // 如果已经是同一个 src 且已加载完成
    if (media.src.endsWith(src) && media.readyState >= 3) {
      media.currentTime = startTime;
      resolve();
      return;
    }

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`${mediaType}加载超时`));
    }, timeout);

    media.addEventListener("canplay", onReady, { once: true });
    media.addEventListener("error", onError, { once: true });
    media.src = src;
    media.load();
  });
}
