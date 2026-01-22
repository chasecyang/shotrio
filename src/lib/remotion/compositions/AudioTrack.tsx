import { Sequence, Audio } from "remotion";
import { RemotionTrack, RemotionTrackItem } from "../types";
import { TrackStates } from "@/types/timeline";
import { useTrackConfig } from "../hooks/use-track-config";

interface AudioTrackProps {
  track: RemotionTrack;
  trackStates: TrackStates;
}

export const AudioTrack: React.FC<AudioTrackProps> = ({
  track,
  trackStates,
}) => {
  const { premountFrames, volume } = useTrackConfig(
    track.trackIndex,
    trackStates
  );

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
            volume={volume}
          />
        </Sequence>
      ))}
    </>
  );
};
