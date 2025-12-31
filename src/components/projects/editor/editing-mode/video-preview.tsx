"use client";

import { useRef, useState, useEffect } from "react";
import { useEditor } from "../editor-context";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Film } from "lucide-react";

/**
 * 视频预览组件
 * 第一期先实现基础UI，播放功能后续完善
 */
export function VideoPreview() {
  const { state } = useEditor();
  const { timeline } = state;
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const duration = timeline?.duration || 0;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePlayPause = () => {
    // TODO: 实现实际播放逻辑
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    setCurrentTime(value[0]);
  };

  if (!timeline || timeline.clips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-white/60">
        <Film className="w-16 h-16" />
        <p className="text-sm">将素材拖入时间轴开始剪辑</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* 预览画面 */}
      <div className="flex-1 flex items-center justify-center">
        {/* 第一期显示第一个片段的缩略图作为预览 */}
        {timeline.clips[0]?.asset && (
          <img
            src={timeline.clips[0].asset.thumbnailUrl || timeline.clips[0].asset.imageUrl || ""}
            alt="预览"
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>

      {/* 播放控制栏 */}
      <div className="p-4 bg-black/60 backdrop-blur space-y-3">
        {/* 进度条 */}
        <div className="space-y-1">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={100}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-white/60">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-white/80 hover:text-white hover:bg-white/10"
          >
            <SkipBack className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="h-12 w-12 p-0 text-white hover:text-white hover:bg-white/20 rounded-full"
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-white/80 hover:text-white hover:bg-white/10"
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

