import { Sequence, OffthreadVideo, useVideoConfig } from "remotion";
import { RemotionTrack, RemotionTrackItem } from "../types";
import { TrackStates } from "@/types/timeline";

interface VideoTrackProps {
  track: RemotionTrack;
  trackStates: TrackStates;
}

export const VideoTrack: React.FC<VideoTrackProps> = ({
  track,
  trackStates,
}) => {
  const { fps } = useVideoConfig();
  const trackState = trackStates[track.trackIndex];

  // 提前 5 秒预加载下一个片段
  const premountFrames = Math.round(fps * 5);

  return (
    <>
      {track.items.map((item: RemotionTrackItem) => (
        <Sequence
          key={item.id}
          from={item.from}
          durationInFrames={item.durationInFrames}
          premountFor={premountFrames}
        >
          <OffthreadVideo
            src={item.src}
            startFrom={item.startFrom}
            volume={trackState?.isMuted ? 0 : trackState?.volume ?? 1}
            muted={trackState?.isMuted}
            pauseWhenBuffering
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </Sequence>
      ))}
    </>
  );
};
