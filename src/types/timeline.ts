import { AssetWithRuntimeStatus } from "./asset";

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
  asset: AssetWithRuntimeStatus;
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




