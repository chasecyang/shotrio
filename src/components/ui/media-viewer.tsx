"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { 
  X, 
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Slider } from "./slider";
import { ScrollArea } from "./scroll-area";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { AssetWithFullData } from "@/types/asset";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface MediaViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: AssetWithFullData;
  onRetry?: (jobId: string) => Promise<void>;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.5;

export function MediaViewer({
  open,
  onOpenChange,
  asset,
  onRetry,
}: MediaViewerProps) {
  const isVideo = asset.assetType === "video";
  const isFailed = asset.runtimeStatus === "failed";
  const errorMessage = asset.errorMessage || "生成失败，请重试";

  // 调试信息
  React.useEffect(() => {
    if (open) {
      console.log('MediaViewer - Asset info:', {
        assetId: asset.id,
        assetName: asset.name,
        isFailed,
        runtimeStatus: asset.runtimeStatus,
        hasOnRetry: !!onRetry,
        mediaUrl: asset.mediaUrl,
        errorMessage: asset.errorMessage,
      });
    }
  }, [open, isFailed, asset, onRetry]);

  // 图片相关状态
  const [scale, setScale] = React.useState(1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  // 视频相关状态
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(asset.duration ? asset.duration / 1000 : 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 复制状态
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  // 源素材状态
  const [sourceAssets, setSourceAssets] = React.useState<AssetWithFullData[]>([]);
  const [loadingSourceAssets, setLoadingSourceAssets] = React.useState(false);

  // 解析生成配置
  const generationConfig = React.useMemo(() => {
    if (!asset.generationConfig) return null;
    try {
      return JSON.parse(asset.generationConfig);
    } catch {
      return null;
    }
  }, [asset.generationConfig]);

  // 格式化日期
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
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
        const { getProjectAssets } = await import("@/lib/actions/asset");
        const allAssets = await getProjectAssets({ projectId: asset.projectId });
        const sources = allAssets.filter(a => asset.sourceAssetIds?.includes(a.id));
        setSourceAssets(sources);
      } catch (error) {
        console.error("加载源素材失败:", error);
      } finally {
        setLoadingSourceAssets(false);
      }
    };

    if (open) {
      loadSourceAssets();
    }
  }, [open, asset.sourceAssetIds, asset.projectId]);

  // 重置状态
  React.useEffect(() => {
    if (open) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      if (isVideo && videoRef.current) {
        videoRef.current.currentTime = 0;
        setCurrentTime(0);
        setIsPlaying(false);
      }
    } else {
      if (isVideo && videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [open, isVideo]);

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
    if (!asset.mediaUrl) return;

    try {
      const response = await fetch(asset.mediaUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${asset.name}${isVideo ? '.mp4' : '.png'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("下载成功");
    } catch (error) {
      console.error("下载失败:", error);
      toast.error("下载失败");
      window.open(asset.mediaUrl, "_blank");
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
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onMouseMove={handleMouseMove}
        >
          <div className="w-full h-full flex">
            {/* 左侧：媒体展示区 */}
            <div 
              ref={containerRef}
              className="flex-1 relative flex items-center justify-center overflow-hidden"
              onWheel={handleWheel}
              onDoubleClick={handleDoubleClick}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {isFailed ? (
                /* 失败状态 */
                <div className="flex flex-col items-center justify-center gap-6 p-8">
                  {/* 失败图标 */}
                  <div className="relative">
                    {/* 脉动红色圆环 */}
                    <div className="absolute inset-0 rounded-full bg-destructive/20 animate-ping" />
                    <div className="relative w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center border-4 border-destructive/30">
                      <AlertCircle className="w-12 h-12 text-destructive" />
                    </div>
                  </div>
                  
                  {/* 错误信息 */}
                  <div className="flex flex-col items-center gap-3 max-w-md text-center">
                    <h3 className="text-2xl font-bold text-white">生成失败</h3>
                    <p className="text-base text-white/70 leading-relaxed">
                      {errorMessage}
                    </p>
                    {onRetry && (
                      <Button
                        size="lg"
                        onClick={handleRetry}
                        className="mt-4 gap-2"
                      >
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
                        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      </Button>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 p-0 text-white/80 hover:text-white hover:bg-white/10"
                          onClick={toggleMute}
                        >
                          {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
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
                        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                /* 图片查看器 */
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.mediaUrl || undefined}
                    alt={asset.name}
                    className={cn(
                      "max-w-[90%] max-h-[90vh] object-contain select-none",
                      isDragging ? "cursor-grabbing" : scale > 1 ? "cursor-grab" : "cursor-default"
                    )}
                    style={{
                      transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                      transition: isDragging ? "none" : "transform 0.2s ease-out",
                    }}
                    draggable={false}
                  />

                  {/* 图片工具栏 */}
                  <div className="absolute top-4 left-4 z-[101] flex items-center gap-1 p-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 shadow-2xl">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-white/80 hover:text-white hover:bg-white/10"
                      onClick={handleZoomOut}
                      disabled={scale <= MIN_SCALE}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <div className="px-2 min-w-[60px] text-center text-sm font-medium text-white/80">
                      {Math.round(scale * 100)}%
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-white/80 hover:text-white hover:bg-white/10"
                      onClick={handleZoomIn}
                      disabled={scale >= MAX_SCALE}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-5 bg-white/20 mx-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-white/80 hover:text-white hover:bg-white/10"
                      onClick={handleReset}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* 提示文本 */}
                  <div className="absolute bottom-4 left-4 z-[101] text-sm text-white/50">
                    双击放大 · 滚轮缩放 · 拖拽平移
                  </div>
                </>
              )}
            </div>

            {/* 右侧：信息面板 */}
            <div className="w-[400px] h-full bg-black/60 backdrop-blur-md border-l border-white/10 flex flex-col">
              {/* 头部 */}
              <div className="p-4 border-b border-white/10 shrink-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white truncate mb-1">
                      {asset.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <Calendar className="h-3 w-3" />
                      {formatDate(asset.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* 重试按钮 - 失败状态时显示 */}
                    {isFailed && onRetry && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-3 text-white/80 hover:text-white hover:bg-white/10 gap-2"
                        onClick={handleRetry}
                      >
                        <RefreshCw className="h-4 w-4" />
                        重试
                      </Button>
                    )}
                    {/* 下载按钮 - 有媒体URL时显示 */}
                    {asset.mediaUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 text-white/80 hover:text-white hover:bg-white/10"
                        onClick={handleDownload}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* 信息内容 */}
              <ScrollArea className="flex-1 overflow-hidden">
                <div className="p-4">
                <div className="space-y-4">
                  {/* Prompt */}
                  {asset.prompt && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                          <FileText className="h-4 w-4" />
                          <span>Prompt</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10"
                          onClick={() => copyToClipboard(asset.prompt!, 'prompt')}
                        >
                          {copiedField === 'prompt' ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-white/70 bg-white/5 rounded-lg p-3 leading-relaxed">
                        {asset.prompt}
                      </p>
                    </div>
                  )}

                  {/* 模型和种子 */}
                  {(asset.modelUsed || asset.seed !== null) && (
                    <>
                      <Separator className="bg-white/10" />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                          <Sparkles className="h-4 w-4" />
                          <span>生成参数</span>
                        </div>
                        <div className="space-y-2">
                          {asset.modelUsed && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-white/60">模型</span>
                              <span className="text-white/90 font-mono">{asset.modelUsed}</span>
                            </div>
                          )}
                          {asset.seed !== null && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-white/60">种子</span>
                              <div className="flex items-center gap-2">
                                <span className="text-white/90 font-mono">{asset.seed}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-white/60 hover:text-white hover:bg-white/10"
                                  onClick={() => copyToClipboard(asset.seed!.toString(), 'seed')}
                                >
                                  {copiedField === 'seed' ? (
                                    <Check className="h-3 w-3 text-green-400" />
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
                      <Separator className="bg-white/10" />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                          <Settings className="h-4 w-4" />
                          <span>详细配置</span>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(generationConfig).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between text-sm">
                              <span className="text-white/60 capitalize">{key}</span>
                              <span className="text-white/90 font-mono text-right max-w-[200px] truncate">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
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
                      <Separator className="bg-white/10" />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                          <ImageIcon className="h-4 w-4" />
                          <span>源素材</span>
                        </div>
                        {loadingSourceAssets ? (
                          <div className="text-sm text-white/60">加载中...</div>
                        ) : sourceAssets.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {sourceAssets.map((source) => (
                              <div
                                key={source.id}
                                className="relative aspect-square rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:border-white/30 transition-colors group"
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
                                    <ImageIcon className="h-6 w-6 text-white/30" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-xs text-white/90 px-2 text-center line-clamp-2">
                                    {source.name}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-white/60">无法加载源素材</div>
                        )}
                      </div>
                    </>
                  )}

                  {/* 标签 */}
                  {asset.tags && asset.tags.length > 0 && (
                    <>
                      <Separator className="bg-white/10" />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                          <TagIcon className="h-4 w-4" />
                          <span>标签</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {asset.tags.map((tag) => (
                            <Badge
                              key={tag.id}
                              variant="secondary"
                              className="bg-white/10 text-white/80 border-white/20 hover:bg-white/15"
                            >
                              {tag.tagValue}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                </div>
              </ScrollArea>
            </div>

            {/* 关闭按钮 - 放在顶部中央 */}
            <DialogPrimitive.Close
              className={cn(
                "fixed top-4 left-1/2 -translate-x-1/2 z-[102]",
                "h-10 w-10 rounded-full flex items-center justify-center",
                "bg-black/60 backdrop-blur-md border border-white/10",
                "text-white/80 hover:text-white hover:bg-white/10",
                "transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
              )}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">关闭</span>
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

