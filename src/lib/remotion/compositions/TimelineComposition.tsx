import { AbsoluteFill } from "remotion";
import { TimelineCompositionProps } from "../types";
import { VideoTrack } from "./VideoTrack";
import { AudioTrack } from "./AudioTrack";

export const TimelineComposition: React.FC<TimelineCompositionProps> = ({
  tracks,
  trackStates,
}) => {
  // 分离视频轨道和音频轨道
  const videoTracks = tracks.filter((t) => t.type === "video");
  const audioTracks = tracks.filter((t) => t.type === "audio");

  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1a1a" }}>
      {/* 视频轨道层 - 按 trackIndex 堆叠，索引小的在下层 */}
      {videoTracks
        .sort((a, b) => a.trackIndex - b.trackIndex)
        .map((track) => (
          <AbsoluteFill key={track.trackIndex}>
            <VideoTrack track={track} trackStates={trackStates} />
          </AbsoluteFill>
        ))}

      {/* 音频轨道层 */}
      {audioTracks.map((track) => (
        <AudioTrack
          key={track.trackIndex}
          track={track}
          trackStates={trackStates}
        />
      ))}
    </AbsoluteFill>
  );
};
