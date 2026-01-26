"use client";

import { useRef, useEffect, useState } from "react";
import { AssetWithFullData } from "@/types/asset";
import { Button } from "@/components/ui/button";
import { X, Play, Pause, Volume2, VolumeX, Maximize2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useTranslations } from "next-intl";

interface AssetPreviewOverlayProps {
  asset: AssetWithFullData;
  onClose: () => void;
}

/**
 * 单素材预览覆盖层 - 在主预览区显示单个素材的播放
 */
export function AssetPreviewOverlay({ asset, onClose }: AssetPreviewOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const t = useTranslations("editor.timeline.assetPreview");

  const isVideo = asset.assetType === "video";
  const mediaUrl = asset.mediaUrl;

  // 格式化时间显示
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // 播放/暂停
  const togglePlayPause = () => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (!media) return;

    if (isPlaying) {
      media.pause();
    } else {
      media.play();
    }
  };

  // 跳转进度
  const handleSeek = (value: number[]) => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (!media) return;
    media.currentTime = value[0] / 1000;
  };

  // 音量控制
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    const media = isVideo ? videoRef.current : audioRef.current;
    if (media) {
      media.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  // 静音切换
  const toggleMute = () => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (!media) return;
    media.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // 全屏
  const handleFullscreen = () => {
    if (videoRef.current) {
      videoRef.current.requestFullscreen?.();
    }
  };

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isPlaying]);

  // 自动播放
  useEffect(() => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (media) {
      media.play().catch(() => {
        // 自动播放可能被浏览器阻止
      });
    }
  }, [isVideo]);

  if (!mediaUrl) {
    return (
      <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-10">
        <div className="text-white/60 text-sm">{t("cannotPreview")}</div>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/10"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black/95 flex flex-col z-10">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center gap-3">
          <span className="text-white/90 text-sm font-medium truncate max-w-md">
            {asset.name}
          </span>
          <span className="text-white/50 text-xs">
            {isVideo ? t("videoPreview") : t("audioPreview")}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white/80 hover:text-white hover:bg-white/10"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* 媒体区域 */}
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        {isVideo ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            className="w-full h-full object-contain"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime * 1000)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration * 1000)}
            onEnded={() => setIsPlaying(false)}
            onClick={togglePlayPause}
          />
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center">
              <Volume2 className="h-16 w-16 text-primary/70" />
            </div>
            <audio
              ref={audioRef}
              src={mediaUrl}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime * 1000)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration * 1000)}
              onEnded={() => setIsPlaying(false)}
            />
          </div>
        )}
      </div>

      {/* 底部控制栏 */}
      <div className="px-4 py-3 bg-gradient-to-t from-black/50 to-transparent">
        {/* 进度条 */}
        <div className="mb-3">
          <Slider
            value={[currentTime]}
            max={duration || 1}
            step={100}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* 播放/暂停 */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={togglePlayPause}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>

            {/* 音量 */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white/80 hover:text-white hover:bg-white/10"
                onClick={toggleMute}
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.1}
                onValueChange={handleVolumeChange}
                className="w-20"
              />
            </div>

            {/* 时间显示 */}
            <span className="text-white/60 text-xs font-mono ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* 右侧按钮 */}
          <div className="flex items-center gap-2">
            {isVideo && (
              <Button
                variant="ghost"
                size="icon"
                className="text-white/80 hover:text-white hover:bg-white/10"
                onClick={handleFullscreen}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
