import {
  TimelineDetail,
  TimelineClipWithAsset,
  TrackStates,
  getTimelineTracks,
} from "@/types/timeline";
import { findAudioClipsAtTime } from "@/lib/utils/timeline-utils";
import { AudioControllerConfig, SYNC_THRESHOLDS, loadMediaWithTimeout } from "./types";

interface AudioTrackState {
  audio: HTMLAudioElement;
  currentClip: TimelineClipWithAsset | null;
  isLoading: boolean;
}

/**
 * AudioController - 多轨道音频控制器
 * 管理多个音频轨道的播放和同步
 */
export class AudioController {
  private tracks: Map<number, AudioTrackState> = new Map();
  private trackStates: TrackStates = {};
  private timeline: TimelineDetail | null = null;
  private isPlaying: boolean = false;
  private syncIntervalId: NodeJS.Timeout | null = null;

  private onError: (trackIndex: number, error: Error) => void;

  // 同步间隔 (毫秒)
  private static readonly SYNC_INTERVAL = 250;

  constructor(config: AudioControllerConfig) {
    this.trackStates = config.trackStates;
    this.onError = config.onError;
  }

  /**
   * 设置时间轴
   */
  setTimeline(timeline: TimelineDetail | null): void {
    this.timeline = timeline;
    this.updateTracks();
  }

  /**
   * 更新轨道状态（音量、静音）
   */
  setTrackStates(states: TrackStates): void {
    this.trackStates = states;
    this.applyVolumeSettings();
  }

  /**
   * 根据 timeline metadata 更新音频轨道
   */
  private updateTracks(): void {
    if (!this.timeline) {
      this.destroyAllTracks();
      return;
    }

    const tracks = getTimelineTracks(this.timeline.metadata);
    const audioTrackIndices = new Set(
      tracks.filter((t) => t.type === "audio").map((t) => t.index)
    );

    console.log(`[AudioController] updateTracks: 找到 ${audioTrackIndices.size} 个音频轨道`, Array.from(audioTrackIndices));

    // 创建新轨道
    audioTrackIndices.forEach((trackIndex) => {
      if (!this.tracks.has(trackIndex)) {
        const audio = new Audio();
        audio.preload = "auto";
        this.tracks.set(trackIndex, {
          audio,
          currentClip: null,
          isLoading: false,
        });
        console.log(`[AudioController] 创建音频轨道 ${trackIndex}`);
      }
    });

    // 删除不存在的轨道
    this.tracks.forEach((state, trackIndex) => {
      if (!audioTrackIndices.has(trackIndex)) {
        state.audio.pause();
        state.audio.src = "";
        this.tracks.delete(trackIndex);
      }
    });

    this.applyVolumeSettings();
  }

  /**
   * 应用音量设置
   */
  private applyVolumeSettings(): void {
    this.tracks.forEach((state, trackIndex) => {
      const trackState = this.trackStates[trackIndex];
      if (trackState) {
        state.audio.volume = trackState.isMuted ? 0 : trackState.volume;
      }
    });
  }

  /**
   * 同步到指定时间（片段切换 + 位置同步）- 同步版本，用于同步循环
   */
  syncToTime(time: number): void {
    if (!this.timeline) return;

    // 找到所有在当前时间播放的音频片段
    const activeAudioClips = findAudioClipsAtTime(this.timeline, time);

    // 调试日志
    if (this.tracks.size > 0 && activeAudioClips.length > 0) {
      console.log(`[AudioController] syncToTime: ${time}ms, 找到 ${activeAudioClips.length} 个音频片段, ${this.tracks.size} 个轨道`);
    }

    // 为每个轨道检查并更新
    this.tracks.forEach((state, trackIndex) => {
      const clipForTrack = activeAudioClips.find((c) => c.trackIndex === trackIndex);

      if (clipForTrack) {
        // 仅在片段变化时加载新音频
        if (state.currentClip?.id !== clipForTrack.id) {
          this.loadAndPlayAudio(trackIndex, clipForTrack, time);
        } else if (this.isPlaying) {
          // 同步位置
          this.syncAudioPosition(state, clipForTrack, time);
        }
      } else {
        // 该轨道当前没有片段，暂停
        if (!state.audio.paused) {
          state.audio.pause();
        }
        state.currentClip = null;
      }
    });
  }

  /**
   * 同步到指定时间（异步版本）- 等待所有音频加载完成
   */
  async syncToTimeAsync(time: number): Promise<void> {
    if (!this.timeline) return;

    // 找到所有在当前时间播放的音频片段
    const activeAudioClips = findAudioClipsAtTime(this.timeline, time);

    // 调试日志
    if (this.tracks.size > 0 && activeAudioClips.length > 0) {
      console.log(`[AudioController] syncToTimeAsync: ${time}ms, 找到 ${activeAudioClips.length} 个音频片段, ${this.tracks.size} 个轨道`);
    }

    // 收集所有需要加载的 Promise
    const loadPromises: Promise<void>[] = [];

    // 为每个轨道检查并更新
    this.tracks.forEach((state, trackIndex) => {
      const clipForTrack = activeAudioClips.find((c) => c.trackIndex === trackIndex);

      if (clipForTrack) {
        // 仅在片段变化时加载新音频
        if (state.currentClip?.id !== clipForTrack.id) {
          loadPromises.push(this.loadAndPlayAudio(trackIndex, clipForTrack, time));
        } else if (this.isPlaying) {
          // 同步位置
          this.syncAudioPosition(state, clipForTrack, time);
        }
      } else {
        // 该轨道当前没有片段，暂停
        if (!state.audio.paused) {
          state.audio.pause();
        }
        state.currentClip = null;
      }
    });

    // 等待所有音频加载完成
    if (loadPromises.length > 0) {
      await Promise.all(loadPromises);
    }
  }

  /**
   * 加载并播放音频
   */
  private async loadAndPlayAudio(
    trackIndex: number,
    clip: TimelineClipWithAsset,
    targetTime: number
  ): Promise<void> {
    const state = this.tracks.get(trackIndex);
    if (!state || state.isLoading) return;

    // 获取音频 URL（mediaUrl 是通用的媒体源 URL）
    const audioUrl = clip.asset.mediaUrl;
    if (!audioUrl) {
      console.warn(`[AudioController] 轨道 ${trackIndex} 片段 ${clip.id} 没有媒体 URL`, {
        assetType: clip.asset.assetType,
        audioData: clip.asset.audioData,
        audioUrl: clip.asset.audioUrl,
        mediaUrl: clip.asset.mediaUrl,
      });
      return;
    }

    state.isLoading = true;

    try {
      // 计算音频内的播放位置
      const relativeTime = targetTime - clip.startTime;
      const audioTime = (clip.trimStart + relativeTime) / 1000;

      console.log(`[AudioController] 加载音频轨道 ${trackIndex}: ${audioUrl}, 时间 ${audioTime}s`);

      await loadMediaWithTimeout(state.audio, audioUrl, audioTime, "音频");
      state.currentClip = clip;

      // 应用音量
      const trackState = this.trackStates[trackIndex];
      state.audio.volume = trackState?.isMuted ? 0 : (trackState?.volume ?? 1);

      // 如果正在播放，启动音频
      if (this.isPlaying) {
        console.log(`[AudioController] 播放音频轨道 ${trackIndex}`);
        await state.audio.play();
      }
    } catch (err) {
      console.error(`[AudioController] 轨道 ${trackIndex} 音频加载失败:`, err);
      this.onError(trackIndex, err as Error);
    } finally {
      state.isLoading = false;
    }
  }

  /**
   * 同步单个音频轨道的位置（使用 playbackRate 渐进修正）
   */
  private syncAudioPosition(
    state: AudioTrackState,
    clip: TimelineClipWithAsset,
    time: number
  ): void {
    const { audio } = state;
    if (audio.paused) return;

    // 检查是否还在当前片段范围内
    const clipEnd = clip.startTime + clip.duration;
    if (time < clip.startTime || time >= clipEnd) return;

    // 计算目标时间
    const relativeTime = time - clip.startTime;
    const targetAudioTime = (clip.trimStart + relativeTime) / 1000;
    const drift = audio.currentTime - targetAudioTime;
    const absDrift = Math.abs(drift);

    if (absDrift < SYNC_THRESHOLDS.IGNORE) {
      // 漂移可忽略，恢复正常速率
      if (audio.playbackRate !== 1.0) {
        audio.playbackRate = 1.0;
      }
    } else if (absDrift < SYNC_THRESHOLDS.SOFT_CORRECT) {
      // 小漂移: 平滑调整 playbackRate
      const targetRate = drift > 0 ? 0.97 : 1.03;
      audio.playbackRate += (targetRate - audio.playbackRate) * 0.3;
    } else if (absDrift < SYNC_THRESHOLDS.HARD_SEEK) {
      // 中等漂移: 更激进但仍平滑的速率修正
      const targetRate = drift > 0 ? 0.92 : 1.08;
      audio.playbackRate += (targetRate - audio.playbackRate) * 0.5;
    } else {
      // 大漂移: 硬跳转
      audio.currentTime = targetAudioTime;
      audio.playbackRate = 1.0;
    }
  }

  /**
   * 开始播放（异步 - 等待音频加载完成）
   */
  async play(currentTime: number): Promise<void> {
    this.isPlaying = true;

    // 异步同步 - 等待所有音频加载完成
    await this.syncToTimeAsync(currentTime);

    // 恢复已加载的音频
    const playPromises: Promise<void>[] = [];
    this.tracks.forEach((state) => {
      if (state.currentClip && state.audio.paused && state.audio.src) {
        playPromises.push(
          state.audio.play().catch((err) => {
            console.error("恢复音频播放失败:", err);
          })
        );
      }
    });

    // 等待所有音频开始播放
    if (playPromises.length > 0) {
      await Promise.all(playPromises);
    }

    // 开始同步循环
    this.startSyncLoop(currentTime);
  }

  /**
   * 暂停播放
   */
  pause(): void {
    this.isPlaying = false;
    this.stopSyncLoop();

    // 暂停所有音频并重置播放速率
    this.tracks.forEach((state) => {
      if (!state.audio.paused) {
        state.audio.pause();
      }
      state.audio.playbackRate = 1.0;
    });
  }

  /**
   * 获取当前时间的回调（用于同步循环）
   */
  private getCurrentTimeCallback: (() => number) | null = null;

  /**
   * 开始同步循环
   */
  private startSyncLoop(initialTime: number): void {
    this.stopSyncLoop();

    // 保存初始时间用于第一次同步
    let lastTime = initialTime;

    this.syncIntervalId = setInterval(() => {
      if (!this.isPlaying) return;

      // 从 PlaybackEngine 获取当前时间
      if (this.getCurrentTimeCallback) {
        lastTime = this.getCurrentTimeCallback();
      }

      // 使用 syncToTime 进行完整的片段检测和同步
      this.syncToTime(lastTime);
    }, AudioController.SYNC_INTERVAL);
  }

  /**
   * 设置获取当前时间的回调
   */
  setGetCurrentTimeCallback(callback: () => number): void {
    this.getCurrentTimeCallback = callback;
  }

  /**
   * 停止同步循环
   */
  private stopSyncLoop(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  /**
   * 销毁所有轨道
   */
  private destroyAllTracks(): void {
    this.tracks.forEach((state) => {
      state.audio.pause();
      state.audio.src = "";
    });
    this.tracks.clear();
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stopSyncLoop();
    this.destroyAllTracks();
    this.timeline = null;
    this.getCurrentTimeCallback = null;
  }
}
