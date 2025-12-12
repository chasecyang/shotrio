"use client";

import { ShotDetail } from "@/types/project";
import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface VideoPreviewPanelProps {
  shot?: ShotDetail;
  shots: ShotDetail[];
  playhead: number;
  isPlaying: boolean;
  onPlayheadChange: (time: number) => void;
  onPlayingChange: (playing: boolean) => void;
}

export function VideoPreviewPanel({
  shot,
  isPlaying,
  onPlayingChange,
}: VideoPreviewPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(console.error);
    } else {
      video.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const togglePlay = () => {
    onPlayingChange(!isPlaying);
  };

  const toggleMute = () => {
    setMuted(!muted);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* 预览区域 */}
      <div className="flex-1 relative flex items-center justify-center p-4">
        {shot?.videoUrl ? (
          <video
            ref={videoRef}
            src={shot.videoUrl}
            className="max-w-full max-h-full rounded-lg shadow-2xl"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => onPlayingChange(false)}
          />
        ) : shot?.imageUrl ? (
          <div className="relative">
            <img
              src={shot.imageUrl}
              alt={`Shot ${shot.order}`}
              className="max-w-full max-h-full rounded-lg shadow-2xl"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
              <p className="text-foreground text-sm font-['JetBrains_Mono']">
                视频未生成
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center mb-4">
              <Play className="w-12 h-12 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-['JetBrains_Mono']">
              选择一个分镜预览
            </p>
          </div>
        )}

        {/* 分镜信息叠加 */}
        {shot && (
          <div className="absolute top-6 left-6 bg-background/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <span className="text-foreground font-['JetBrains_Mono'] text-lg">
                #{shot.order}
              </span>
              {shot.visualDescription && (
                <span className="text-foreground/80 text-sm max-w-md truncate">
                  {shot.visualDescription}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 控制栏 */}
      {shot?.videoUrl && (
        <div className="h-20 border-t border-border bg-card px-6 flex items-center gap-4">
          {/* 播放按钮 */}
          <Button
            size="icon"
            variant="ghost"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </Button>

          {/* 时间码 */}
          <span className="text-sm font-['JetBrains_Mono'] text-muted-foreground min-w-[80px]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* 进度条 */}
          <div className="flex-1">
            <Slider
              value={[currentTime]}
              max={duration || 1}
              step={0.1}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
          </div>

          {/* 音量控制 */}
          <div className="flex items-center gap-2 min-w-[120px]">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleMute}
            >
              {muted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>
            <Slider
              value={[muted ? 0 : volume]}
              max={1}
              step={0.1}
              onValueChange={(value) => setVolume(value[0])}
              className="w-16"
            />
          </div>
        </div>
      )}
    </div>
  );
}
