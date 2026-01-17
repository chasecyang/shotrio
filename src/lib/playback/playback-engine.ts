import { TimelineDetail, TimelineClipWithAsset, TrackStates } from "@/types/timeline";
import { findVideoClipAtTime } from "@/lib/utils/timeline-utils";
import {
  PlaybackState,
  PlaybackEvent,
  STATE_TRANSITIONS,
  PlaybackEngineConfig,
  StateChangeCallback,
  TimeUpdateCallback,
} from "./types";
import { TimeSource } from "./time-source";
import { VideoController } from "./video-controller";
import { AudioController } from "./audio-controller";

/**
 * PlaybackEngine - 播放引擎主类
 * 使用独立时钟驱动播放，视频和音频都从主时钟同步
 */
export class PlaybackEngine {
  private state: PlaybackState = "idle";
  private timeline: TimelineDetail | null = null;
  private trackStates: TrackStates = {};

  private timeSource: TimeSource;
  private videoController: VideoController;
  private audioController: AudioController;

  private onStateChange?: StateChangeCallback;
  private onTimeUpdate?: TimeUpdateCallback;
  private onError?: (error: Error) => void;

  // 用于 seek 操作
  private wasPlayingBeforeSeek: boolean = false;

  constructor(config: PlaybackEngineConfig) {
    this.timeline = config.timeline;
    this.trackStates = config.trackStates;
    this.onStateChange = config.onStateChange;
    this.onTimeUpdate = config.onTimeUpdate;
    this.onError = config.onError;

    // 创建 TimeSource（独立时钟）
    this.timeSource = new TimeSource();

    // 创建 VideoController（被动模式，由主时钟驱动）
    this.videoController = new VideoController({
      onError: (error) => {
        this.onError?.(error);
      },
    });

    // 创建 AudioController
    this.audioController = new AudioController({
      trackStates: this.trackStates,
      onError: (trackIndex, error) => {
        console.error(`Audio track ${trackIndex} error:`, error);
      },
    });

    // 设置音频控制器的时间获取回调
    this.audioController.setGetCurrentTimeCallback(() => this.timeSource.getCurrentTime());

    // 初始化
    if (this.timeline) {
      this.videoController.setTimeline(this.timeline);
      this.audioController.setTimeline(this.timeline);
    }
  }

  /**
   * 状态机事件分发
   */
  private dispatch(event: PlaybackEvent): void {
    const transitions = STATE_TRANSITIONS[this.state];
    const nextState = transitions[event.type];

    if (nextState) {
      this.state = nextState;
      this.onStateChange?.(this.state);
    }
  }

  /**
   * 获取当前状态
   */
  getState(): PlaybackState {
    return this.state;
  }

  /**
   * 获取当前时间
   */
  getCurrentTime(): number {
    return this.timeSource.getCurrentTime();
  }

  /**
   * 获取当前片段
   */
  getCurrentClip(): TimelineClipWithAsset | null {
    return this.videoController.getCurrentClip();
  }

  /**
   * 是否正在播放
   */
  isPlaying(): boolean {
    return this.state === "playing";
  }

  /**
   * 是否正在加载
   */
  isLoading(): boolean {
    return this.state === "loading" || this.state === "seeking";
  }

  /**
   * 设置时间轴
   */
  async setTimeline(timeline: TimelineDetail | null): Promise<void> {
    this.timeline = timeline;
    this.videoController.setTimeline(timeline);
    this.audioController.setTimeline(timeline);

    if (timeline) {
      this.dispatch({ type: "LOAD_TIMELINE", timeline });
      await this.initializeFirstClip();
    } else {
      this.dispatch({ type: "RESET" });
    }
  }

  /**
   * 初始化第一个片段
   */
  private async initializeFirstClip(): Promise<void> {
    if (!this.timeline || this.timeline.clips.length === 0) {
      this.dispatch({ type: "LOAD_ERROR", error: new Error("No clips") });
      return;
    }

    const firstClip = findVideoClipAtTime(this.timeline, 0);
    if (!firstClip) {
      this.dispatch({ type: "LOAD_SUCCESS" });
      return;
    }

    try {
      await this.videoController.loadClip(firstClip, firstClip.trimStart / 1000);
      this.timeSource.setCurrentTime(0);
      this.dispatch({ type: "LOAD_SUCCESS" });
      // 通知 UI 更新当前片段和时间
      this.onTimeUpdate?.(0);
    } catch (err) {
      this.dispatch({ type: "LOAD_ERROR", error: err as Error });
    }
  }

  /**
   * 更新轨道状态
   */
  setTrackStates(states: TrackStates): void {
    this.trackStates = states;
    this.audioController.setTrackStates(states);
  }

  /**
   * 时钟回调 - 每帧更新
   */
  private handleClockTick = (time: number): void => {
    if (!this.timeline) return;

    // 检查是否到达时间轴末尾
    if (time >= this.timeline.duration) {
      this.timeSource.setCurrentTime(this.timeline.duration);
      this.pause();
      this.onTimeUpdate?.(this.timeline.duration);
      return;
    }

    // 通知 UI 更新时间
    this.onTimeUpdate?.(time);

    // 同步视频到当前时间
    this.videoController.syncToTime(time);
  };

  /**
   * 播放
   */
  async play(): Promise<void> {
    if (!this.timeline || this.timeline.clips.length === 0) return;
    if (this.state === "playing") return;

    // 如果播放到结尾，重新从头开始
    if (this.getCurrentTime() >= this.timeline.duration - 100) {
      await this.seek(0);
    }

    // 如果还没有加载片段，初始化
    if (!this.videoController.getCurrentClip()) {
      await this.initializeFirstClip();
    }

    this.dispatch({ type: "PLAY" });

    try {
      // 启动独立时钟
      this.timeSource.start(this.handleClockTick);

      // 并行启动视频和音频播放
      await Promise.all([
        this.videoController.play(),
        this.audioController.play(this.getCurrentTime()),
      ]);
    } catch (err) {
      this.timeSource.stop();
      this.dispatch({ type: "PAUSE" });
      this.onError?.(err as Error);
    }
  }

  /**
   * 暂停
   */
  pause(): void {
    if (this.state !== "playing") return;

    // 停止独立时钟
    this.timeSource.stop();

    this.dispatch({ type: "PAUSE" });
    this.videoController.pause();
    this.audioController.pause();
  }

  /**
   * 切换播放/暂停
   */
  togglePlayPause(): void {
    if (this.state === "playing") {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * 跳转到指定时间（完整 seek，用于拖拽结束或点击）
   */
  async seek(time: number): Promise<void> {
    if (!this.timeline) return;

    const clampedTime = Math.max(0, Math.min(time, this.timeline.duration));

    // 记录 seek 前的播放状态
    this.wasPlayingBeforeSeek = this.state === "playing";

    // 暂停播放（包括时钟）
    if (this.wasPlayingBeforeSeek) {
      this.timeSource.stop();
      this.videoController.pause();
      this.audioController.pause();
    }

    this.dispatch({ type: "SEEK", time: clampedTime });

    try {
      // 更新时间源并通知 UI
      this.timeSource.setCurrentTime(clampedTime);
      this.onTimeUpdate?.(clampedTime);

      // 跳转视频
      await this.videoController.seekToTimelineTime(clampedTime);

      // 同步音频
      this.audioController.syncToTime(clampedTime);

      this.dispatch({ type: "SEEK_COMPLETE" });

      // 如果之前在播放，恢复播放
      if (this.wasPlayingBeforeSeek) {
        await this.play();
      }
    } catch (err) {
      this.dispatch({ type: "LOAD_ERROR", error: err as Error });
      this.onError?.(err as Error);
    }
  }

  /**
   * 拖拽中的 seek（仅更新 UI，不加载媒体）
   */
  seekDragging(time: number): void {
    if (!this.timeline) return;

    const clampedTime = Math.max(0, Math.min(time, this.timeline.duration));

    // 第一次拖拽时暂停
    if (this.state === "playing") {
      this.wasPlayingBeforeSeek = true;
      this.timeSource.stop();
      this.videoController.pause();
      this.audioController.pause();
      this.dispatch({ type: "SEEK", time: clampedTime });
    }

    // 更新时间源并通知 UI
    this.timeSource.setCurrentTime(clampedTime);
    this.onTimeUpdate?.(clampedTime);
  }

  /**
   * 拖拽结束的 seek（加载媒体并恢复播放）
   */
  async seekDragEnd(time: number): Promise<void> {
    if (!this.timeline) return;

    const clampedTime = Math.max(0, Math.min(time, this.timeline.duration));

    try {
      // 跳转视频
      await this.videoController.seekToTimelineTime(clampedTime);

      // 同步音频
      this.audioController.syncToTime(clampedTime);

      this.dispatch({ type: "SEEK_COMPLETE" });

      // 如果之前在播放，恢复播放
      if (this.wasPlayingBeforeSeek) {
        this.wasPlayingBeforeSeek = false;
        await this.play();
      }
    } catch (err) {
      this.dispatch({ type: "LOAD_ERROR", error: err as Error });
      this.onError?.(err as Error);
    }
  }

  /**
   * 获取视频元素
   */
  getVideoElements(): { videoA: HTMLVideoElement; videoB: HTMLVideoElement } {
    return this.videoController.getVideoElements();
  }

  /**
   * 获取当前活跃视频标识
   */
  getActiveVideoId(): "A" | "B" {
    return this.videoController.getActiveVideoId();
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.pause();
    this.timeSource.destroy();
    this.videoController.destroy();
    this.audioController.destroy();
  }
}
