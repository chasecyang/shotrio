import {
  TimelineClipWithAsset,
  TimelineDetail,
  isAudioTrack,
  isVideoTrack,
} from "@/types/timeline";

/**
 * 根据时间轴时间计算当前应该显示的片段
 */
export function findClipAtTime(
  timeline: TimelineDetail,
  currentTime: number
): {
  clip: TimelineClipWithAsset | null;
  clipStartTime: number;
  videoTime: number;
} {
  if (!timeline.clips || timeline.clips.length === 0) {
    return { clip: null, clipStartTime: 0, videoTime: 0 };
  }

  // 找到当前时间点对应的片段
  let clip = timeline.clips.find((c) => {
    const clipEnd = c.startTime + c.duration;
    return currentTime >= c.startTime && currentTime < clipEnd;
  });

  // 如果找不到片段，可能是因为时间在边界上（等于或超过 duration）
  // 这种情况下返回最后一个片段
  if (!clip && currentTime >= timeline.duration && timeline.clips.length > 0) {
    clip = timeline.clips[timeline.clips.length - 1];
  }

  if (!clip) {
    return { clip: null, clipStartTime: 0, videoTime: 0 };
  }

  // 计算在该片段内的相对时间
  const relativeTime = currentTime - clip.startTime;
  // 加上片段的 trimStart 得到视频实际播放位置（秒）
  const videoTime = (clip.trimStart + relativeTime) / 1000;

  return {
    clip,
    clipStartTime: clip.startTime,
    videoTime,
  };
}

/**
 * 计算下一个片段的信息（用于预加载）
 * @deprecated 使用 getNextVideoClip 代替，此函数不区分轨道类型
 */
export function getNextClip(
  timeline: TimelineDetail,
  currentClip: TimelineClipWithAsset
): TimelineClipWithAsset | null {
  const currentIndex = timeline.clips.findIndex((c) => c.id === currentClip.id);
  if (currentIndex === -1 || currentIndex === timeline.clips.length - 1) {
    return null;
  }
  return timeline.clips[currentIndex + 1];
}

/**
 * 获取视频轨道上的下一个片段（按时间顺序）
 * 用于 VideoController 的片段预加载和切换
 */
export function getNextVideoClip(
  timeline: TimelineDetail,
  currentClip: TimelineClipWithAsset
): TimelineClipWithAsset | null {
  // 只获取视频轨道的片段
  const videoClips = timeline.clips
    .filter((c) => isVideoTrack(c.trackIndex))
    .sort((a, b) => a.startTime - b.startTime);

  const currentIndex = videoClips.findIndex((c) => c.id === currentClip.id);
  if (currentIndex === -1 || currentIndex === videoClips.length - 1) {
    return null;
  }
  return videoClips[currentIndex + 1];
}

/**
 * 格式化时间显示 (ms -> MM:SS.mm)
 * @param ms 毫秒数
 * @param showMilliseconds 是否显示毫秒（默认显示）
 */
export function formatTimeDisplay(ms: number, showMilliseconds: boolean = true): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  if (showMilliseconds) {
    // 计算毫秒部分，保留2位（百分之一秒）
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
  }
  
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * 计算拖拽位置对应的时间轴时间
 */
export function calculateTimeFromPosition(
  mouseX: number,
  trackRef: HTMLElement,
  pixelsPerMs: number
): number {
  const rect = trackRef.getBoundingClientRect();
  const relativeX = mouseX - rect.left;
  return Math.max(0, relativeX / pixelsPerMs);
}

/**
 * 磁吸效果：如果接近某个片段边缘，自动对齐
 */
export function snapToNearbyClips(
  targetTime: number,
  clips: TimelineClipWithAsset[],
  excludeClipId?: string,
  snapThreshold: number = 500 // 500ms 内自动吸附
): number {
  let snappedTime = targetTime;
  let minDistance = snapThreshold;

  clips.forEach((clip) => {
    if (clip.id === excludeClipId) return;

    // 检查是否接近片段的开始时间
    const distanceToStart = Math.abs(targetTime - clip.startTime);
    if (distanceToStart < minDistance) {
      minDistance = distanceToStart;
      snappedTime = clip.startTime;
    }

    // 检查是否接近片段的结束时间
    const clipEnd = clip.startTime + clip.duration;
    const distanceToEnd = Math.abs(targetTime - clipEnd);
    if (distanceToEnd < minDistance) {
      minDistance = distanceToEnd;
      snappedTime = clipEnd;
    }
  });

  // 检查是否接近时间轴起点
  if (Math.abs(targetTime) < snapThreshold) {
    snappedTime = 0;
  }

  return snappedTime;
}

/**
 * 验证裁剪参数的有效性
 */
export function validateTrimValues(
  trimStart: number,
  duration: number,
  assetDuration: number
): { valid: boolean; error?: string } {
  if (trimStart < 0) {
    return { valid: false, error: "入点不能小于 0" };
  }

  if (duration < 500) {
    return { valid: false, error: "片段时长不能小于 0.5 秒" };
  }

  if (trimStart + duration > assetDuration) {
    return {
      valid: false,
      error: "出点超出素材时长",
    };
  }

  return { valid: true };
}

// ============================================
// 多轨道工具函数
// ============================================

/**
 * 按轨道索引对片段进行分组
 */
export function groupClipsByTrack(
  clips: TimelineClipWithAsset[]
): Map<number, TimelineClipWithAsset[]> {
  const grouped = new Map<number, TimelineClipWithAsset[]>();

  clips.forEach((clip) => {
    const trackIndex = clip.trackIndex;
    if (!grouped.has(trackIndex)) {
      grouped.set(trackIndex, []);
    }
    grouped.get(trackIndex)!.push(clip);
  });

  // 对每个轨道内的片段按 order 排序
  grouped.forEach((trackClips) => {
    trackClips.sort((a, b) => a.order - b.order);
  });

  return grouped;
}

/**
 * 在指定时间点找到所有正在播放的音频片段
 */
export function findAudioClipsAtTime(
  timeline: TimelineDetail,
  currentTime: number
): TimelineClipWithAsset[] {
  return timeline.clips.filter((clip) => {
    if (!isAudioTrack(clip.trackIndex)) return false;
    const clipEnd = clip.startTime + clip.duration;
    return currentTime >= clip.startTime && currentTime < clipEnd;
  });
}

/**
 * 在指定时间点找到视频轨道上正在播放的片段
 */
export function findVideoClipAtTime(
  timeline: TimelineDetail,
  currentTime: number
): TimelineClipWithAsset | null {
  return (
    timeline.clips.find((clip) => {
      if (!isVideoTrack(clip.trackIndex)) return false;
      const clipEnd = clip.startTime + clip.duration;
      return currentTime >= clip.startTime && currentTime < clipEnd;
    }) ?? null
  );
}

/**
 * 重新计算指定轨道内片段的顺序和开始时间（连续排列）
 */
export function recalculateTrackClipPositions(
  clips: TimelineClipWithAsset[],
  trackIndex: number
): Array<{ clipId: string; order: number; startTime: number }> {
  const trackClips = clips
    .filter((c) => c.trackIndex === trackIndex)
    .sort((a, b) => a.order - b.order);

  let currentTime = 0;
  return trackClips.map((clip, index) => {
    const result = {
      clipId: clip.id,
      order: index,
      startTime: currentTime,
    };
    currentTime += clip.duration;
    return result;
  });
}

