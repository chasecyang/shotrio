import { useVideoConfig } from "remotion";
import { TrackStates } from "@/types/timeline";

/**
 * 轨道配置 Hook
 * 提取 VideoTrack 和 AudioTrack 的共享逻辑
 */
export function useTrackConfig(trackIndex: number, trackStates: TrackStates) {
  const { fps } = useVideoConfig();
  const trackState = trackStates[trackIndex];

  // 提前 4 秒预加载下一个片段（Remotion 官方建议）
  const premountFrames = Math.round(fps * 4);

  // 音量计算：静音时为 0，否则使用轨道音量（默认 1）
  const volume = trackState?.isMuted ? 0 : trackState?.volume ?? 1;

  return { premountFrames, volume };
}
