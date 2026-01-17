import { Sequence, Audio, useVideoConfig } from "remotion";
import { RemotionTrack, RemotionTrackItem } from "../types";
import { TrackStates } from "@/types/timeline";

interface AudioTrackProps {
  track: RemotionTrack;
  trackStates: TrackStates;
}

export const AudioTrack: React.FC<AudioTrackProps> = ({
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
          <Audio
            src={item.src}
            startFrom={item.startFrom}
            volume={trackState?.isMuted ? 0 : trackState?.volume ?? 1}
            pauseWhenBuffering
          />
        </Sequence>
      ))}
    </>
  );
};
