import { Series } from "remotion";
import { Video } from "@remotion/media";
import { RemotionTrack, RemotionTrackItem } from "../types";
import { TrackStates } from "@/types/timeline";
import { useTrackConfig } from "../hooks/use-track-config";

interface VideoTrackProps {
  track: RemotionTrack;
  trackStates: TrackStates;
}

export const VideoTrack: React.FC<VideoTrackProps> = ({
  track,
  trackStates,
}) => {
  const { premountFrames, volume } = useTrackConfig(
    track.trackIndex,
    trackStates
  );

  return (
    <Series>
      {track.items.map((item: RemotionTrackItem) => (
        <Series.Sequence
          key={item.id}
          durationInFrames={item.durationInFrames}
          premountFor={premountFrames}
        >
          <Video
            src={item.src}
            trimBefore={item.startFrom}
            volume={volume}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </Series.Sequence>
      ))}
    </Series>
  );
};
