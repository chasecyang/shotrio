import { TrackStates } from "@/types/timeline";

/**
 * 时间单位转换函数
 */
export const msToFrames = (ms: number, fps: number): number =>
  Math.round((ms / 1000) * fps);

export const framesToMs = (frames: number, fps: number): number =>
  (frames / fps) * 1000;

/**
 * Remotion 轨道项（视频或音频片段）
 */
export interface RemotionTrackItem {
  id: string;
  from: number; // 开始帧
  durationInFrames: number;
  type: "video" | "audio";
  src: string; // mediaUrl
  startFrom: number; // trimStart 转换为帧
}

/**
 * Remotion 轨道
 */
export interface RemotionTrack {
  name: string;
  trackIndex: number;
  type: "video" | "audio";
  items: RemotionTrackItem[];
}

/**
 * TimelineComposition 输入 Props
 */
export interface TimelineCompositionProps extends Record<string, unknown> {
  tracks: RemotionTrack[];
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  trackStates: TrackStates;
}
