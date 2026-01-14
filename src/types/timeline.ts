import { AssetWithFullData } from "./asset";

/**
 * Timeline - 视频剪辑时间轴
 */
export interface Timeline {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  description?: string | null;
  duration: number; // 总时长(毫秒)
  fps: number; // 帧率
  resolution: string; // 分辨率
  metadata?: string | null; // JSON: 背景音乐、全局滤镜等
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TimelineClip - 时间轴片段
 */
export interface TimelineClip {
  id: string;
  timelineId: string;
  assetId: string;
  trackIndex: number; // 轨道索引
  startTime: number; // 在时间轴上的开始时间(ms)
  duration: number; // 片段在时间轴上的时长(ms)
  trimStart: number; // 素材入点(ms)
  trimEnd?: number | null; // 素材出点(ms), null表示到素材结尾
  order: number; // 在轨道内的排序
  metadata?: string | null; // JSON: 转场效果、音量、滤镜等
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TimelineClipWithAsset - 带素材信息的片段（用于前端展示）
 */
export interface TimelineClipWithAsset extends TimelineClip {
  asset: AssetWithFullData;
}

/**
 * TimelineDetail - 完整的Timeline数据（包含clips）
 */
export interface TimelineDetail extends Timeline {
  clips: TimelineClipWithAsset[];
}

/**
 * CreateTimelineInput - 创建时间轴的输入参数
 */
export interface CreateTimelineInput {
  projectId: string;
  title?: string;
  description?: string;
  fps?: number;
  resolution?: string;
}

/**
 * UpdateTimelineInput - 更新时间轴的输入参数
 */
export interface UpdateTimelineInput {
  title?: string;
  description?: string;
  duration?: number;
  fps?: number;
  resolution?: string;
  metadata?: string;
}

/**
 * AddClipInput - 添加片段到时间轴的输入参数
 */
export interface AddClipInput {
  assetId: string;
  trackIndex?: number;
  startTime?: number;
  duration?: number;
  trimStart?: number;
  trimEnd?: number;
  order?: number;
}

/**
 * UpdateClipInput - 更新片段的输入参数
 */
export interface UpdateClipInput {
  trackIndex?: number;
  startTime?: number;
  duration?: number;
  trimStart?: number;
  trimEnd?: number;
  order?: number;
  metadata?: string;
}

/**
 * ReorderClipInput - 批量重排序片段的输入参数
 */
export interface ReorderClipInput {
  clipId: string;
  order: number;
  startTime?: number;
}

// ============================================
// 多轨道系统类型定义
// ============================================

/**
 * 轨道索引范围常量
 * - 视频轨道: 0-99
 * - 音频轨道: 100+
 */
export const VIDEO_TRACK_START = 0;
export const AUDIO_TRACK_START = 100;

/**
 * 轨道类型
 */
export type TrackType = "video" | "audio";

/**
 * 轨道配置
 */
export interface TrackConfig {
  index: number;
  type: TrackType;
  name: string;
  color: string;
  height: number;
}

/**
 * 默认轨道配置
 * - 视频轨道从 0 开始
 * - 音频轨道从 100 开始
 */
export const DEFAULT_TRACKS: TrackConfig[] = [
  { index: 0, type: "video", name: "视频", color: "#8a8177", height: 80 },
  {
    index: 100,
    type: "audio",
    name: "音频 1",
    color: "#8a8177",
    height: 56,
  },
];

/**
 * 单个轨道的运行时状态
 */
export interface TrackState {
  volume: number; // 0-1
  isMuted: boolean;
}

/**
 * 所有轨道的状态映射
 */
export interface TrackStates {
  [trackIndex: number]: TrackState;
}

/**
 * 默认轨道状态（与 DEFAULT_TRACKS 对应）
 */
export const DEFAULT_TRACK_STATES: TrackStates = {
  0: { volume: 1, isMuted: false },
  100: { volume: 1, isMuted: false },
};

/**
 * 根据轨道索引判断是否为音频轨道（索引 >= 100）
 */
export function isAudioTrack(trackIndex: number): boolean {
  return trackIndex >= AUDIO_TRACK_START;
}

/**
 * 根据轨道索引判断是否为视频轨道（索引 < 100）
 */
export function isVideoTrack(trackIndex: number): boolean {
  return trackIndex < AUDIO_TRACK_START;
}

// ============================================
// Timeline Metadata 类型定义
// ============================================

/**
 * Timeline 元数据结构
 */
export interface TimelineMetadata {
  tracks: TrackConfig[];
}

/**
 * 解析 Timeline metadata 字符串为结构化数据
 */
export function parseTimelineMetadata(
  metadata: string | null | undefined
): TimelineMetadata | null {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata) as TimelineMetadata;
  } catch {
    return null;
  }
}

/**
 * 序列化 Timeline metadata 为 JSON 字符串
 */
export function stringifyTimelineMetadata(metadata: TimelineMetadata): string {
  return JSON.stringify(metadata);
}

/**
 * 获取 Timeline 的轨道配置（如果没有则返回默认配置）
 */
export function getTimelineTracks(
  metadata: string | null | undefined
): TrackConfig[] {
  const parsed = parseTimelineMetadata(metadata);
  return parsed?.tracks ?? DEFAULT_TRACKS;
}

// ============================================
// 轨道管理工具函数
// ============================================

/**
 * 获取下一个可用的视频轨道索引
 */
export function getNextVideoTrackIndex(tracks: TrackConfig[]): number {
  const videoTracks = tracks.filter((t) => t.type === "video");
  if (videoTracks.length === 0) return VIDEO_TRACK_START;
  const maxIndex = Math.max(...videoTracks.map((t) => t.index));
  return maxIndex + 1;
}

/**
 * 获取下一个可用的音频轨道索引
 */
export function getNextAudioTrackIndex(tracks: TrackConfig[]): number {
  const audioTracks = tracks.filter((t) => t.type === "audio");
  if (audioTracks.length === 0) return AUDIO_TRACK_START;
  const maxIndex = Math.max(...audioTracks.map((t) => t.index));
  return maxIndex + 1;
}

/**
 * 添加新轨道到配置
 */
export function addTrackToConfig(
  tracks: TrackConfig[],
  type: TrackType
): TrackConfig[] {
  const newIndex =
    type === "video"
      ? getNextVideoTrackIndex(tracks)
      : getNextAudioTrackIndex(tracks);

  const trackCount = tracks.filter((t) => t.type === type).length + 1;
  const name = type === "video" ? `视频 ${trackCount}` : `音频 ${trackCount}`;

  const newTrack: TrackConfig = {
    index: newIndex,
    type,
    name,
    color: "#8a8177",
    height: type === "video" ? 80 : 56,
  };

  // 按类型分组排序：视频轨道在前，音频轨道在后
  const newTracks = [...tracks, newTrack];
  return newTracks.sort((a, b) => a.index - b.index);
}

/**
 * 从配置中移除轨道
 */
export function removeTrackFromConfig(
  tracks: TrackConfig[],
  trackIndex: number
): TrackConfig[] {
  return tracks.filter((t) => t.index !== trackIndex);
}

/**
 * 根据轨道配置生成轨道状态
 */
export function generateTrackStates(tracks: TrackConfig[]): TrackStates {
  const states: TrackStates = {};
  for (const track of tracks) {
    states[track.index] = { volume: 1, isMuted: false };
  }
  return states;
}

/**
 * 获取所有视频轨道
 */
export function getVideoTracks(tracks: TrackConfig[]): TrackConfig[] {
  return tracks.filter((t) => t.type === "video").sort((a, b) => a.index - b.index);
}

/**
 * 获取所有音频轨道
 */
export function getAudioTracks(tracks: TrackConfig[]): TrackConfig[] {
  return tracks.filter((t) => t.type === "audio").sort((a, b) => a.index - b.index);
}



