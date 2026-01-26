import { AssetWithFullData } from "./asset";

/**
 * Cut - 视频剪辑版本
 */
export interface Cut {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  description?: string | null;
  duration: number; // 总时长(毫秒)
  fps: number; // 帧率
  resolution?: string | null; // 分辨率
  metadata?: string | null; // JSON: 轨道配置、背景音乐、全局滤镜等
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CutClip - 剪辑片段
 */
export interface CutClip {
  id: string;
  cutId: string;
  assetId: string;
  trackIndex: number; // 轨道索引（0-99 视频轨道，100+ 音频轨道）
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
 * CutClipWithAsset - 带素材信息的片段（用于前端展示）
 */
export interface CutClipWithAsset extends CutClip {
  asset: AssetWithFullData;
}

/**
 * CutDetail - 完整的 Cut 数据（包含 clips）
 */
export interface CutDetail extends Cut {
  clips: CutClipWithAsset[];
}

/**
 * CutListItem - Cut 列表项（用于素材库展示）
 */
export interface CutListItem extends Cut {
  clipCount: number;
  thumbnailUrl?: string | null; // 第一个视频片段的缩略图
}

/**
 * CreateCutInput - 创建剪辑的输入参数
 */
export interface CreateCutInput {
  projectId: string;
  title?: string;
  description?: string;
  fps?: number;
  resolution?: string;
}

/**
 * UpdateCutInput - 更新剪辑的输入参数
 */
export interface UpdateCutInput {
  title?: string;
  description?: string;
  duration?: number;
  fps?: number;
  resolution?: string;
  metadata?: string;
}

/**
 * AddCutClipInput - 添加片段到剪辑的输入参数
 */
export interface AddCutClipInput {
  assetId: string;
  trackIndex?: number;
  startTime?: number;
  duration?: number;
  trimStart?: number;
  trimEnd?: number;
  order?: number;
}

/**
 * UpdateCutClipInput - 更新片段的输入参数
 */
export interface UpdateCutClipInput {
  trackIndex?: number;
  startTime?: number;
  duration?: number;
  trimStart?: number;
  trimEnd?: number;
  order?: number;
  metadata?: string;
}

/**
 * ReorderCutClipInput - 批量重排序片段的输入参数
 */
export interface ReorderCutClipInput {
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
  { index: 0, type: "video", name: "video", color: "#8a8177", height: 80 },
  {
    index: 100,
    type: "audio",
    name: "audio_1",
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
// Cut Metadata 类型定义
// ============================================

/**
 * Cut 元数据结构
 */
export interface CutMetadata {
  tracks: TrackConfig[];
}

/**
 * 解析 Cut metadata 字符串为结构化数据
 */
export function parseCutMetadata(
  metadata: string | null | undefined
): CutMetadata | null {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata) as CutMetadata;
  } catch {
    return null;
  }
}

/**
 * 序列化 Cut metadata 为 JSON 字符串
 */
export function stringifyCutMetadata(metadata: CutMetadata): string {
  return JSON.stringify(metadata);
}

/**
 * 获取 Cut 的轨道配置（如果没有则返回默认配置）
 */
export function getCutTracks(
  metadata: string | null | undefined
): TrackConfig[] {
  const parsed = parseCutMetadata(metadata);
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
  const name = type === "video" ? `video_${trackCount}` : `audio_${trackCount}`;

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

// ============================================
// 向后兼容的类型别名
// ============================================

/** @deprecated 使用 Cut 代替 */
export type Timeline = Cut;
/** @deprecated 使用 CutClip 代替 */
export type TimelineClip = CutClip;
/** @deprecated 使用 CutClipWithAsset 代替 */
export type TimelineClipWithAsset = CutClipWithAsset;
/** @deprecated 使用 CutDetail 代替 */
export type TimelineDetail = CutDetail;
/** @deprecated 使用 CreateCutInput 代替 */
export type CreateTimelineInput = CreateCutInput;
/** @deprecated 使用 UpdateCutInput 代替 */
export type UpdateTimelineInput = UpdateCutInput;
/** @deprecated 使用 AddCutClipInput 代替 */
export type AddClipInput = AddCutClipInput;
/** @deprecated 使用 UpdateCutClipInput 代替 */
export type UpdateClipInput = UpdateCutClipInput;
/** @deprecated 使用 ReorderCutClipInput 代替 */
export type ReorderClipInput = ReorderCutClipInput;
/** @deprecated 使用 CutMetadata 代替 */
export type TimelineMetadata = CutMetadata;
/** @deprecated 使用 parseCutMetadata 代替 */
export const parseTimelineMetadata = parseCutMetadata;
/** @deprecated 使用 stringifyCutMetadata 代替 */
export const stringifyTimelineMetadata = stringifyCutMetadata;
/** @deprecated 使用 getCutTracks 代替 */
export const getTimelineTracks = getCutTracks;
