import { TimelineDetail, TimelineClipWithAsset } from "@/types/timeline";
import { findVideoClipAtTime, getNextVideoClip } from "@/lib/utils/timeline-utils";
import { VideoControllerConfig, loadMediaWithTimeout } from "./types";

// 同步阈值（毫秒）
const SYNC_THRESHOLD = 200;

/**
 * VideoController - 双缓冲视频控制器
 * 管理两个视频元素，实现无缝切换
 * 被动模式：根据主时钟同步视频位置
 */
export class VideoController {
  private videoA: HTMLVideoElement;
  private videoB: HTMLVideoElement;
  private activeVideo: "A" | "B" = "A";

  private currentClip: TimelineClipWithAsset | null = null;
  private pendingClip: TimelineClipWithAsset | null = null;
  private timeline: TimelineDetail | null = null;

  private isPlaying: boolean = false;
  private isSwitching: boolean = false;
  private isLoading: boolean = false;

  private onError: (error: Error) => void;

  constructor(config: VideoControllerConfig) {
    this.onError = config.onError;

    // 创建两个视频元素
    this.videoA = document.createElement("video");
    this.videoB = document.createElement("video");

    this.videoA.preload = "auto";
    this.videoB.preload = "auto";
    this.videoA.playsInline = true;
    this.videoB.playsInline = true;
  }

  /**
   * 设置时间轴
   */
  setTimeline(timeline: TimelineDetail | null): void {
    this.timeline = timeline;
    this.currentClip = null;
    this.pendingClip = null;
  }

  /**
   * 获取活跃视频元素
   */
  getActiveVideoElement(): HTMLVideoElement {
    return this.activeVideo === "A" ? this.videoA : this.videoB;
  }

  /**
   * 获取非活跃视频元素
   */
  private getInactiveVideoElement(): HTMLVideoElement {
    return this.activeVideo === "A" ? this.videoB : this.videoA;
  }

  /**
   * 获取视频元素引用
   */
  getVideoElements(): { videoA: HTMLVideoElement; videoB: HTMLVideoElement } {
    return { videoA: this.videoA, videoB: this.videoB };
  }

  /**
   * 获取当前活跃视频标识
   */
  getActiveVideoId(): "A" | "B" {
    return this.activeVideo;
  }

  /**
   * 获取当前片段
   */
  getCurrentClip(): TimelineClipWithAsset | null {
    return this.currentClip;
  }

  /**
   * 加载指定片段
   */
  async loadClip(clip: TimelineClipWithAsset, videoTime: number): Promise<void> {
    if (!clip.asset.mediaUrl) {
      throw new Error("片段没有媒体URL");
    }

    this.isLoading = true;
    const video = this.getActiveVideoElement();

    try {
      await loadMediaWithTimeout(video, clip.asset.mediaUrl, videoTime, "视频");
      this.currentClip = clip;
    } catch (err) {
      this.onError(err as Error);
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 开始播放
   */
  async play(): Promise<void> {
    if (!this.timeline) {
      return; // 没有时间轴，静默返回
    }

    // 如果没有当前片段，不播放视频（可能当前时间没有视频内容）
    if (!this.currentClip) {
      this.isPlaying = true;
      return;
    }

    const video = this.getActiveVideoElement();
    this.isPlaying = true;

    try {
      await video.play();
      this.preloadNextClip();
    } catch (err) {
      // 播放失败不影响整体播放流程
      console.warn("视频播放失败:", err);
    }
  }

  /**
   * 暂停播放
   */
  pause(): void {
    this.isPlaying = false;
    this.videoA.pause();
    this.videoB.pause();
  }

  /**
   * 跳转到指定视频时间
   */
  seekToVideoTime(videoTime: number): void {
    const video = this.getActiveVideoElement();
    video.currentTime = videoTime;
  }

  /**
   * 预加载下一片段
   */
  preloadNextClip(): void {
    if (!this.timeline || !this.currentClip) return;

    const nextClip = getNextVideoClip(this.timeline, this.currentClip);
    if (!nextClip || !nextClip.asset.mediaUrl) {
      this.pendingClip = null;
      return;
    }

    // 检查是否已经预加载了这个片段
    if (this.pendingClip?.id === nextClip.id) return;

    const inactiveVideo = this.getInactiveVideoElement();
    inactiveVideo.src = nextClip.asset.mediaUrl;
    inactiveVideo.currentTime = nextClip.trimStart / 1000;
    inactiveVideo.load();
    this.pendingClip = nextClip;
  }

  /**
   * 切换到下一个片段
   */
  private async switchToNextClip(): Promise<void> {
    if (this.isSwitching) return;

    const nextClip = this.pendingClip;
    if (!nextClip) {
      // 没有下一片段，暂停视频但不触发全局结束
      // 让主时钟继续运行，音频可以继续播放
      this.videoA.pause();
      this.videoB.pause();
      this.currentClip = null;
      return;
    }

    this.isSwitching = true;

    const currentVideo = this.getActiveVideoElement();
    const nextVideo = this.getInactiveVideoElement();

    try {
      // 开始播放预加载的视频
      if (this.isPlaying) {
        await nextVideo.play();
      }

      // 切换活跃视频
      this.activeVideo = this.activeVideo === "A" ? "B" : "A";
      this.currentClip = nextClip;
      this.pendingClip = null;

      // 停止旧视频
      currentVideo.pause();

      // 预加载下一个
      this.preloadNextClip();
    } catch (err) {
      console.error("切换视频失败:", err);
    } finally {
      this.isSwitching = false;
    }
  }

  /**
   * 同步视频到指定时间（由主时钟调用）
   * 这是被动同步模式的核心方法
   */
  syncToTime(timelineTime: number): void {
    if (!this.timeline || !this.isPlaying || this.isLoading || this.isSwitching) return;

    // 查找当前时间应该播放的视频片段
    const targetClip = findVideoClipAtTime(this.timeline, timelineTime);

    if (!targetClip) {
      // 当前时间没有视频片段，暂停视频
      if (this.currentClip) {
        this.videoA.pause();
        this.videoB.pause();
        this.currentClip = null;
      }
      return;
    }

    // 如果需要切换到不同的片段
    if (targetClip.id !== this.currentClip?.id) {
      // 检查是否是预加载的下一个片段
      if (this.pendingClip?.id === targetClip.id) {
        this.switchToNextClip();
      } else {
        // 需要加载新片段
        const relativeTime = timelineTime - targetClip.startTime;
        const videoTime = (targetClip.trimStart + relativeTime) / 1000;
        this.loadClip(targetClip, videoTime).then(() => {
          if (this.isPlaying) {
            this.getActiveVideoElement().play().catch(() => {});
          }
          this.preloadNextClip();
        });
      }
      return;
    }

    // 同一片段，检查视频位置是否需要同步
    const video = this.getActiveVideoElement();
    const relativeTime = timelineTime - this.currentClip.startTime;
    const targetVideoTime = (this.currentClip.trimStart + relativeTime) / 1000;
    const currentVideoTime = video.currentTime;
    const drift = Math.abs(currentVideoTime - targetVideoTime) * 1000; // 转为毫秒

    // 如果漂移超过阈值，进行硬跳转
    if (drift > SYNC_THRESHOLD) {
      video.currentTime = targetVideoTime;
    }

    // 检查是否接近片段结尾，需要切换
    const clipEndVideoTime = (this.currentClip.trimStart + this.currentClip.duration) / 1000;
    if (video.currentTime >= clipEndVideoTime - 0.1) {
      this.switchToNextClip();
    }
  }

  /**
   * 根据时间轴时间定位到正确的片段
   */
  async seekToTimelineTime(
    timelineTime: number
  ): Promise<{ clip: TimelineClipWithAsset; videoTime: number } | null> {
    if (!this.timeline) return null;

    const clip = findVideoClipAtTime(this.timeline, timelineTime);
    if (!clip || !clip.asset.mediaUrl) {
      // 没有视频片段在当前时间
      this.currentClip = null;
      return null;
    }

    // 计算视频内的播放位置
    const relativeTime = timelineTime - clip.startTime;
    const videoTime = (clip.trimStart + relativeTime) / 1000;

    // 如果是不同的片段，需要切换
    if (clip.id !== this.currentClip?.id) {
      await this.loadClip(clip, videoTime);
    } else {
      this.seekToVideoTime(videoTime);
    }

    // 预加载下一个片段
    this.preloadNextClip();

    return { clip, videoTime };
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.pause();

    this.videoA.src = "";
    this.videoB.src = "";

    this.currentClip = null;
    this.pendingClip = null;
    this.timeline = null;
  }
}
