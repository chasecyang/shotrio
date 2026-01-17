/**
 * TimeSource - 独立时钟时间源
 * 使用 requestAnimationFrame 驱动时间推进，不依赖视频播放状态
 */
export class TimeSource {
  private currentTime: number = 0;
  private isRunning: boolean = false;
  private lastFrameTime: number = 0;
  private animationFrameId: number | null = null;
  private onTick?: (time: number) => void;

  /**
   * 启动独立时钟
   */
  start(onTick: (time: number) => void): void {
    if (this.isRunning) return;

    this.onTick = onTick;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.tick();
  }

  /**
   * 停止时钟
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 时钟循环
   */
  private tick = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;

    this.currentTime += delta;
    this.onTick?.(this.currentTime);

    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  /**
   * 设置当前时间
   */
  setCurrentTime(time: number): void {
    this.currentTime = time;
    // 如果时钟正在运行，重置帧时间以避免跳跃
    if (this.isRunning) {
      this.lastFrameTime = performance.now();
    }
  }

  /**
   * 获取当前时间
   */
  getCurrentTime(): number {
    return this.currentTime;
  }

  /**
   * 是否正在运行
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stop();
    this.currentTime = 0;
    this.onTick = undefined;
  }
}
