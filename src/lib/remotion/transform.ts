import {
  TimelineDetail,
  TrackStates,
  isVideoTrack,
} from "@/types/timeline";
import {
  TimelineCompositionProps,
  RemotionTrack,
  RemotionTrackItem,
  msToFrames,
} from "./types";

/**
 * 解析分辨率字符串
 */
function parseResolution(resolution: string): [number, number] {
  const [w, h] = resolution.split("x").map(Number);
  return [w || 1920, h || 1080];
}

/**
 * 将 Timeline 数据转换为 Remotion Composition Props
 */
export function timelineToRemotionProps(
  timeline: TimelineDetail,
  trackStates: TrackStates
): TimelineCompositionProps {
  const fps = timeline.fps || 30;
  const [width, height] = parseResolution(timeline.resolution);

  // 按轨道分组
  const trackMap = new Map<number, RemotionTrackItem[]>();

  for (const clip of timeline.clips) {
    // 跳过没有 mediaUrl 的片段
    if (!clip.asset.mediaUrl) continue;

    if (!trackMap.has(clip.trackIndex)) {
      trackMap.set(clip.trackIndex, []);
    }

    trackMap.get(clip.trackIndex)!.push({
      id: clip.id,
      from: msToFrames(clip.startTime, fps),
      durationInFrames: msToFrames(clip.duration, fps),
      type: isVideoTrack(clip.trackIndex) ? "video" : "audio",
      src: clip.asset.mediaUrl,
      startFrom: msToFrames(clip.trimStart, fps),
    });
  }

  // 构建轨道数组
  const tracks: RemotionTrack[] = [];
  trackMap.forEach((items, trackIndex) => {
    tracks.push({
      name: `Track ${trackIndex}`,
      trackIndex,
      type: isVideoTrack(trackIndex) ? "video" : "audio",
      items: items.sort((a, b) => a.from - b.from),
    });
  });

  // 计算总帧数（至少 1 帧）
  const durationInFrames = Math.max(1, msToFrames(timeline.duration, fps));

  return {
    tracks,
    fps,
    width,
    height,
    durationInFrames,
    trackStates,
  };
}
