import { Composition } from "remotion";
import { z } from "zod";
import { TimelineComposition } from "./compositions/TimelineComposition";
import { TimelineCompositionProps } from "./types";

const defaultProps: TimelineCompositionProps = {
  tracks: [],
  trackStates: {},
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 300,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition<z.ZodTypeAny, TimelineCompositionProps>
        id="TimelineComposition"
        component={TimelineComposition}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
        calculateMetadata={({ props }) => {
          return {
            durationInFrames: props.durationInFrames as number,
            fps: props.fps as number,
            width: props.width as number,
            height: props.height as number,
          };
        }}
      />
    </>
  );
};
