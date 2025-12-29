"use client";

import { useState, useEffect, useRef } from "react";
import { ShotDetail } from "@/types/project";
import { Button } from "@/components/ui/button";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  X 
} from "lucide-react";
import Image from "next/image";

interface ShotPlaybackPlayerProps {
  shots: ShotDetail[];
  currentIndex: number;
  isPaused: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onTogglePause: () => void;
  onExit: () => void;
}

export function ShotPlaybackPlayer({
  shots,
  currentIndex,
  isPaused,
  onNext,
  onPrevious,
  onTogglePause,
  onExit,
}: ShotPlaybackPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const currentShot = shots[currentIndex];
  const isFirstShot = currentIndex === 0;
  const isLastShot = currentIndex === shots.length - 1;

  // 获取第一张关联素材
  const firstAsset = currentShot?.shotAssets?.[0]?.asset;

  // 根据分镜内容确定类型
  const contentType = currentShot?.videoUrl 
    ? "video" 
    : firstAsset?.imageUrl 
    ? "image" 
    : "text";

  // 处理视频播放结束
  const handleVideoEnded = () => {
    setIsVideoPlaying(false);
    if (!isLastShot) {
      onNext();
    } else {
      onExit();
    }
  };

  // 视频播放/暂停控制
  useEffect(() => {
    if (contentType === "video" && videoRef.current) {
      if (isPaused) {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      } else {
        videoRef.current.play().catch(console.error);
        setIsVideoPlaying(true);
      }
    }
  }, [isPaused, contentType]);

  // 图片/文字自动切换
  useEffect(() => {
    if (contentType !== "video" && !isPaused && currentShot) {
      const duration = currentShot.duration || 3000;
      const timer = setTimeout(() => {
        if (!isLastShot) {
          onNext();
        } else {
          onExit();
        }
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [contentType, isPaused, currentShot, isLastShot, onNext, onExit]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case " ":
        case "Spacebar":
          e.preventDefault();
          onTogglePause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (!isFirstShot) onPrevious();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (!isLastShot) onNext();
          break;
        case "Escape":
          e.preventDefault();
          onExit();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFirstShot, isLastShot, onNext, onPrevious, onTogglePause, onExit]);

  if (!currentShot) {
    return null;
  }

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      {/* 内容显示区域 */}
      <div className="w-full h-full flex items-center justify-center">
        {contentType === "video" && currentShot.videoUrl && (
          <video
            ref={videoRef}
            src={currentShot.videoUrl}
            className="max-w-full max-h-full object-contain"
            autoPlay
            onEnded={handleVideoEnded}
            onPlay={() => setIsVideoPlaying(true)}
            onPause={() => setIsVideoPlaying(false)}
          />
        )}

        {contentType === "image" && firstAsset?.imageUrl && (
          <div className="relative w-full h-full">
            <Image
              src={firstAsset.imageUrl}
              alt={`分镜 ${currentShot.order}`}
              fill
              className="object-contain"
            />
          </div>
        )}

        {contentType === "text" && (
          <div className="max-w-2xl px-8 text-center">
            <p className="text-white text-2xl leading-relaxed">
              {currentShot.description || "无画面描述"}
            </p>
          </div>
        )}
      </div>

      {/* 控制栏 */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm border-t border-white/10">
        <div className="flex items-center justify-between px-6 py-4">
          {/* 左侧：导航控制 */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevious}
              disabled={isFirstShot}
              className="text-white hover:text-white hover:bg-white/20 disabled:opacity-30"
            >
              <SkipBack className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onTogglePause}
              className="text-white hover:text-white hover:bg-white/20"
            >
              {isPaused || !isVideoPlaying ? (
                <Play className="h-5 w-5" />
              ) : (
                <Pause className="h-5 w-5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={isLastShot ? onExit : onNext}
              className="text-white hover:text-white hover:bg-white/20"
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>

          {/* 中间：进度指示 */}
          <div className="flex items-center gap-3">
            <div className="text-white/60 text-sm font-mono">
              分镜 {currentIndex + 1} / {shots.length}
            </div>
            
            {/* 进度条 */}
            <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white/80 transition-all"
                style={{ width: `${((currentIndex + 1) / shots.length) * 100}%` }}
              />
            </div>
          </div>

          {/* 右侧：退出按钮 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onExit}
            className="text-white hover:text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

