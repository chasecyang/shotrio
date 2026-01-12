"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Copy,
  Check,
  FileText,
  Settings,
  Image as ImageIcon,
  Tag as TagIcon,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Calendar,
  Pencil,
  Loader2,
  Music,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AssetWithFullData, AssetTag } from "@/types/asset";
import Image from "next/image";
import { toast } from "sonner";
import { updateAsset, getProjectAssets } from "@/lib/actions/asset";
import { TagEditor } from "./tag-editor";
import { AssetVersionPanel } from "./asset-version-panel";

interface AssetDetailViewProps {
  asset: AssetWithFullData;
  onBack: () => void;
  onRetry?: (jobId: string) => Promise<void>;
  onEdit?: (asset: AssetWithFullData) => void;
  onRegenerate?: (asset: AssetWithFullData) => void;
  onAssetUpdated: () => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.5;

export function AssetDetailView({
  asset,
  onBack,
  onRetry,
  onEdit,
  onRegenerate,
  onAssetUpdated,
}: AssetDetailViewProps) {
  const isVideo = asset.assetType === "video";
  const isAudio = asset.assetType === "audio";
  const isFailed = asset.runtimeStatus === "failed";
  const isGenerating = asset.runtimeStatus === "pending" || asset.runtimeStatus === "processing";
  const errorMessage = asset.errorMessage || "生成失败，请重试";

  // 名称编辑状态
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(asset.name);
  const [isSavingName, setIsSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // 标签状态
  const [tags, setTags] = useState<AssetTag[]>(asset.tags || []);

  // 图片相关状态
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 视频相关状态
  const videoRef = useRef<HTMLVideoElement>(null);
  // 音频相关状态
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(
    asset.duration ? asset.duration / 1000 : 0
  );
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 复制状态
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 源素材状态
  const [sourceAssets, setSourceAssets] = useState<AssetWithFullData[]>([]);
  const [loadingSourceAssets, setLoadingSourceAssets] = useState(false);

  // 解析生成配置
  const generationConfig = useMemo(() => {
    if (!asset.generationConfig) return null;
    try {
      return JSON.parse(asset.generationConfig);
    } catch {
      return null;
    }
  }, [asset.generationConfig]);

  // 格式化日期
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 复制到剪贴板
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success("已复制到剪贴板");
    } catch (error) {
      console.error("复制失败:", error);
      toast.error("复制失败");
    }
  };

  // 加载源素材
  useEffect(() => {
    const loadSourceAssets = async () => {
      if (!asset.sourceAssetIds || asset.sourceAssetIds.length === 0) return;

      setLoadingSourceAssets(true);
      try {
        const allAssets = await getProjectAssets({ projectId: asset.projectId });
        const sources = allAssets.filter((a) =>
          asset.sourceAssetIds?.includes(a.id)
        );
        setSourceAssets(sources);
      } catch (error) {
        console.error("加载源素材失败:", error);
      } finally {
        setLoadingSourceAssets(false);
      }
    };

    loadSourceAssets();
  }, [asset.sourceAssetIds, asset.projectId]);

  // 同步 asset 变化到本地状态
  useEffect(() => {
    setEditedName(asset.name);
    setTags(asset.tags || []);
  }, [asset]);

  // 名称编辑聚焦
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // 保存名称
  const handleSaveName = async () => {
    if (!editedName.trim() || editedName === asset.name) {
      setIsEditingName(false);
      setEditedName(asset.name);
      return;
    }

    setIsSavingName(true);
    try {
      const result = await updateAsset(asset.id, { name: editedName.trim() });
      if (result.success) {
        toast.success("名称已更新");
        setIsEditingName(false);
        onAssetUpdated();
      } else {
        toast.error(result.error || "更新失败");
        setEditedName(asset.name);
      }
    } catch (error) {
      console.error("更新名称失败:", error);
      toast.error("更新失败");
      setEditedName(asset.name);
    } finally {
      setIsSavingName(false);
    }
  };

  // 名称编辑键盘事件
  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      setIsEditingName(false);
      setEditedName(asset.name);
    }
  };

  // 标签变化处理
  const handleTagsChange = (newTags: AssetTag[]) => {
    setTags(newTags);
    onAssetUpdated();
  };

  // 图片缩放控制
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + ZOOM_STEP, MAX_SCALE));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - ZOOM_STEP, MIN_SCALE));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!isVideo) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setScale((prev) => Math.min(Math.max(prev + delta, MIN_SCALE), MAX_SCALE));
    }
  };

  const handleDoubleClick = () => {
    if (!isVideo) {
      if (scale === 1) {
        setScale(2);
      } else {
        handleReset();
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isVideo && scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
    if (isVideo) {
      resetControlsTimeout();
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 视频控制
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  };

  const handleProgressChange = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (!newMuted && volume === 0) {
        setVolume(0.5);
        videoRef.current.volume = 0.5;
      }
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    resetControlsTimeout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  const handleDownload = async () => {
    const downloadUrl = isAudio ? (asset.audioUrl || asset.mediaUrl) : asset.mediaUrl;
    if (!downloadUrl) return;

    try {
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const extension = isVideo ? ".mp4" : isAudio ? ".mp3" : ".png";
      a.download = `${asset.name}${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("下载成功");
    } catch (error) {
      console.error("下载失败:", error);
      toast.error("下载失败");
      if (downloadUrl) {
        window.open(downloadUrl, "_blank");
      }
    }
  };

  const handleRetry = async () => {
    if (!onRetry) {
      toast.error("重试功能不可用");
      return;
    }

    if (!asset.latestJobId) {
      toast.error("无法找到相关任务信息");
      return;
    }

    await onRetry(asset.latestJobId);
  };

  return (
    <div className="h-full flex flex-col">
      {/* 头部 - 返回按钮 */}
      <div className="shrink-0 px-4 py-3 border-b flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <div className="flex-1" />
        {/* 编辑按钮 - 仅对图片显示 */}
        {!isVideo && !isAudio && !isFailed && onEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(asset)}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            编辑
          </Button>
        )}
        {/* 重新生成按钮 - 仅对有 prompt 的 AI 生成素材显示 */}
        {asset.prompt && !isFailed && onRegenerate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRegenerate(asset)}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            重新生成
          </Button>
        )}
        {/* 下载按钮 */}
        {(asset.mediaUrl || asset.audioUrl) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            下载
          </Button>
        )}
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：媒体预览区 */}
        <div
          ref={containerRef}
          className="flex-1 relative flex items-center justify-center overflow-hidden bg-muted/30"
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {isGenerating ? (
            /* 生成中状态 */
            <div className="flex flex-col items-center justify-center gap-6 p-8">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="relative w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary/30">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
              </div>
              <div className="flex flex-col items-center gap-3 max-w-md text-center">
                <h3 className="text-2xl font-bold">正在生成</h3>
                <p className="text-base text-muted-foreground leading-relaxed">
                  素材正在生成中，请稍候...
                </p>
              </div>
            </div>
          ) : isFailed ? (
            /* 失败状态 */
            <div className="flex flex-col items-center justify-center gap-6 p-8">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-destructive/20 animate-ping" />
                <div className="relative w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center border-4 border-destructive/30">
                  <AlertCircle className="w-12 h-12 text-destructive" />
                </div>
              </div>
              <div className="flex flex-col items-center gap-3 max-w-md text-center">
                <h3 className="text-2xl font-bold">生成失败</h3>
                <p className="text-base text-muted-foreground leading-relaxed">
                  {errorMessage}
                </p>
                {onRetry && (
                  <Button size="lg" onClick={handleRetry} className="mt-4 gap-2">
                    <RefreshCw className="h-4 w-4" />
                    重试生成
                  </Button>
                )}
              </div>
            </div>
          ) : isVideo ? (
            <>
              {/* 视频播放器 */}
              <video
                ref={videoRef}
                src={asset.mediaUrl || undefined}
                className="max-w-full max-h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onClick={togglePlay}
              />

              {/* 视频控制栏 */}
              <div
                className={cn(
                  "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300",
                  showControls ? "opacity-100" : "opacity-0"
                )}
              >
                {/* 进度条 */}
                <div className="mb-3">
                  <Slider
                    value={[currentTime]}
                    max={videoDuration || 100}
                    step={0.1}
                    onValueChange={handleProgressChange}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-white/80 mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(videoDuration)}</span>
                  </div>
                </div>

                {/* 控制按钮 */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 w-9 p-0 text-white/80 hover:text-white hover:bg-white/10"
                    onClick={togglePlay}
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-white/80 hover:text-white hover:bg-white/10"
                      onClick={toggleMute}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="w-20">
                      <Slider
                        value={[isMuted ? 0 : volume]}
                        max={1}
                        step={0.01}
                        onValueChange={handleVolumeChange}
                        className="cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex-1" />

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 w-9 p-0 text-white/80 hover:text-white hover:bg-white/10"
                    onClick={toggleFullscreen}
                  >
                    {isFullscreen ? (
                      <Minimize className="h-4 w-4" />
                    ) : (
                      <Maximize className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : isAudio ? (
            /* 音频播放器 */
            <div className="flex flex-col items-center justify-center gap-6 p-8">
              {/* 音频图标 */}
              <div className="relative">
                <div className={cn(
                  "w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary/20",
                  isPlaying && "animate-pulse"
                )}>
                  <Music className="w-16 h-16 text-primary/70" />
                </div>
              </div>

              {/* 隐藏的音频元素 */}
              <audio
                ref={audioRef}
                src={asset.audioUrl || asset.mediaUrl || undefined}
                onTimeUpdate={() => {
                  if (audioRef.current) {
                    setCurrentTime(audioRef.current.currentTime);
                  }
                }}
                onLoadedMetadata={() => {
                  if (audioRef.current) {
                    setVideoDuration(audioRef.current.duration);
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />

              {/* 音频控制栏 */}
              <div className="w-full max-w-md space-y-4">
                {/* 进度条 */}
                <div>
                  <Slider
                    value={[currentTime]}
                    max={videoDuration || 100}
                    step={0.1}
                    onValueChange={(value) => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = value[0];
                        setCurrentTime(value[0]);
                      }
                    }}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(videoDuration)}</span>
                  </div>
                </div>

                {/* 控制按钮 */}
                <div className="flex items-center justify-center gap-4">
                  {/* 播放/暂停按钮 */}
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 w-12 rounded-full p-0"
                    onClick={() => {
                      if (audioRef.current) {
                        if (isPlaying) {
                          audioRef.current.pause();
                        } else {
                          audioRef.current.play();
                        }
                        setIsPlaying(!isPlaying);
                      }
                    }}
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                  </Button>

                  {/* 音量控制 */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0"
                      onClick={() => {
                        if (audioRef.current) {
                          const newMuted = !isMuted;
                          audioRef.current.muted = newMuted;
                          setIsMuted(newMuted);
                          if (!newMuted && volume === 0) {
                            setVolume(0.5);
                            audioRef.current.volume = 0.5;
                          }
                        }
                      }}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="w-24">
                      <Slider
                        value={[isMuted ? 0 : volume]}
                        max={1}
                        step={0.01}
                        onValueChange={(value) => {
                          const newVolume = value[0];
                          if (audioRef.current) {
                            audioRef.current.volume = newVolume;
                            setVolume(newVolume);
                            setIsMuted(newVolume === 0);
                          }
                        }}
                        className="cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 图片查看器 */
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.mediaUrl || undefined}
                alt={asset.name}
                className={cn(
                  "max-w-[90%] max-h-[90%] object-contain select-none",
                  isDragging
                    ? "cursor-grabbing"
                    : scale > 1
                    ? "cursor-grab"
                    : "cursor-default"
                )}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transition: isDragging ? "none" : "transform 0.2s ease-out",
                }}
                draggable={false}
              />

              {/* 图片工具栏 */}
              <div className="absolute top-4 left-4 flex items-center gap-1 p-1.5 rounded-xl bg-background/80 backdrop-blur-md border shadow-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handleZoomOut}
                  disabled={scale <= MIN_SCALE}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <div className="px-2 min-w-[50px] text-center text-sm font-medium">
                  {Math.round(scale * 100)}%
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handleZoomIn}
                  disabled={scale >= MAX_SCALE}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-5 bg-border mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handleReset}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>

              {/* 提示文本 */}
              <div className="absolute bottom-4 left-4 text-sm text-muted-foreground">
                双击放大 · 滚轮缩放 · 拖拽平移
              </div>
            </>
          )}
        </div>

        {/* 右侧：信息面板 */}
        <div className="w-[360px] border-l flex flex-col bg-background min-h-0">
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-4">
              {/* 名称和日期 */}
              <div className="space-y-2">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      ref={nameInputRef}
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={handleNameKeyDown}
                      onBlur={handleSaveName}
                      disabled={isSavingName}
                      className="h-8 text-base font-semibold"
                    />
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-2 group cursor-pointer"
                    onClick={() => setIsEditingName(true)}
                  >
                    <h3 className="text-base font-semibold truncate flex-1">
                      {asset.name}
                    </h3>
                    <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDate(asset.createdAt)}
                </div>
              </div>

              <Separator />

              {/* 标签编辑 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TagIcon className="h-4 w-4" />
                  <span>标签</span>
                </div>
                <TagEditor
                  assetId={asset.id}
                  tags={tags}
                  onTagsChange={handleTagsChange}
                />
              </div>

              {/* 版本历史 */}
              {asset.versionCount > 1 && (
                <>
                  <Separator />
                  <AssetVersionPanel
                    asset={asset}
                    onVersionChange={onAssetUpdated}
                  />
                </>
              )}

              {/* Prompt */}
              {asset.prompt && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <FileText className="h-4 w-4" />
                        <span>Prompt</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => copyToClipboard(asset.prompt!, "prompt")}
                      >
                        {copiedField === "prompt" ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">
                      {asset.prompt}
                    </p>
                  </div>
                </>
              )}

              {/* 模型和种子 */}
              {(asset.modelUsed || asset.seed !== null) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Sparkles className="h-4 w-4" />
                      <span>生成参数</span>
                    </div>
                    <div className="space-y-2">
                      {asset.modelUsed && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">模型</span>
                          <span className="font-mono">{asset.modelUsed}</span>
                        </div>
                      )}
                      {asset.seed !== null && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">种子</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{asset.seed}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() =>
                                copyToClipboard(asset.seed!.toString(), "seed")
                              }
                            >
                              {copiedField === "seed" ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* 生成配置 */}
              {generationConfig && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Settings className="h-4 w-4" />
                      <span>详细配置</span>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(generationConfig).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-muted-foreground capitalize">
                            {key}
                          </span>
                          <span className="font-mono text-right max-w-[180px] truncate">
                            {typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 源素材 */}
              {asset.sourceAssetIds && asset.sourceAssetIds.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ImageIcon className="h-4 w-4" />
                      <span>源素材</span>
                    </div>
                    {loadingSourceAssets ? (
                      <div className="text-sm text-muted-foreground">
                        加载中...
                      </div>
                    ) : sourceAssets.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {sourceAssets.map((source) => (
                          <div
                            key={source.id}
                            className="relative aspect-square rounded-lg overflow-hidden bg-muted border hover:border-primary/50 transition-colors group"
                          >
                            {source.displayUrl ? (
                              <Image
                                src={source.displayUrl}
                                alt={source.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-xs text-white px-2 text-center line-clamp-2">
                                {source.name}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        无法加载源素材
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* 失败时显示重试按钮 */}
              {isFailed && onRetry && (
                <>
                  <Separator />
                  <Button onClick={handleRetry} className="w-full gap-2">
                    <RefreshCw className="h-4 w-4" />
                    重试生成
                  </Button>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
