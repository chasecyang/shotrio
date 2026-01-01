import { TimelineClipWithAsset, TimelineDetail } from "@/types/timeline";

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
  const clip = timeline.clips.find((c) => {
    const clipEnd = c.startTime + c.duration;
    return currentTime >= c.startTime && currentTime < clipEnd;
  });

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
 * 格式化时间显示 (ms -> mm:ss)
 */
export function formatTimeDisplay(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * 重新计算片段的顺序和开始时间（连续排列）
 * 用于拖拽重排后自动调整所有片段位置
 */
export function recalculateClipPositions(
  clips: TimelineClipWithAsset[]
): Array<{ clipId: string; order: number; startTime: number }> {
  let currentTime = 0;
  return clips
    .sort((a, b) => a.order - b.order)
    .map((clip, index) => {
      const result = {
        clipId: clip.id,
        order: index,
        startTime: currentTime,
      };
      currentTime += clip.duration;
      return result;
    });
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

