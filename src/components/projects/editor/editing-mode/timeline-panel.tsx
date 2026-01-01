"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useEditor } from "../editor-context";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Plus, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { TimelineClipItem } from "./timeline-clip-item";
import { addClipToTimeline, removeClip, reorderClips, updateClip } from "@/lib/actions/timeline";
import { toast } from "sonner";
import { AddAssetDialog } from "./add-asset-dialog";
import { AssetWithRuntimeStatus } from "@/types/asset";
import { recalculateClipPositions, formatTimeDisplay } from "@/lib/utils/timeline-utils";
import { UseVideoPlaybackReturn } from "@/hooks/use-video-playback";

interface TimelinePanelProps {
  playback: UseVideoPlaybackReturn;
}

/**
 * 时间轴面板组件
 */
export function TimelinePanel({ playback }: TimelinePanelProps) {
  const { state, updateTimeline } = useEditor();
  const { timeline } = state;
  
  const [zoom, setZoom] = useState(1); // 缩放级别
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [trimmingClipInfo, setTrimmingClipInfo] = useState<{
    clipId: string;
    newDuration: number;
  } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const timelineRulerRef = useRef<HTMLDivElement>(null);

  // 从 playback prop 获取播放控制
  const {
    isPlaying,
    currentTime,
    currentClip,
    togglePlayPause,
    seekTo,
    pause,
  } = playback;

  const pixelsPerMs = 0.1 * zoom; // 每毫秒对应的像素数

  // 时间标尺鼠标按下 - 开始拖拽或跳转
  const handleTimelineMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRulerRef.current || !timeline) return;
    
    e.preventDefault();
    pause(); // 按下时暂停播放
    
    const rect = timelineRulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(clickX / pixelsPerMs, timeline.duration));
    
    // 立即跳转到点击位置
    seekTo(newTime);
    
    // 启动拖拽模式
    setIsDraggingPlayhead(true);
  }, [pause, pixelsPerMs, timeline, seekTo]);

  // 鼠标移动处理（拖拽播放头）
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingPlayhead || !timelineRulerRef.current || !timeline) return;

    const rect = timelineRulerRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(offsetX / pixelsPerMs, timeline.duration));
    
    seekTo(newTime);
  }, [isDraggingPlayhead, pixelsPerMs, timeline, seekTo]);

  // 鼠标释放处理
  const handleMouseUp = useCallback(() => {
    setIsDraggingPlayhead(false);
  }, []);

  // 监听全局鼠标事件（用于拖拽）
  useEffect(() => {
    if (isDraggingPlayhead) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingPlayhead, handleMouseMove, handleMouseUp]);

  if (!timeline) return null;

  // 跳转到上一个片段
  const skipToPrevious = () => {
    if (!timeline || !currentClip) return;
    const currentIndex = timeline.clips.findIndex((c) => c.id === currentClip.id);
    if (currentIndex > 0) {
      const prevClip = timeline.clips[currentIndex - 1];
      seekTo(prevClip.startTime);
    } else {
      seekTo(0);
    }
  };

  // 跳转到下一个片段
  const skipToNext = () => {
    if (!timeline || !currentClip) return;
    const currentIndex = timeline.clips.findIndex((c) => c.id === currentClip.id);
    if (currentIndex < timeline.clips.length - 1) {
      const nextClip = timeline.clips[currentIndex + 1];
      seekTo(nextClip.startTime);
    }
  };

  // 删除片段
  const handleDeleteClip = async (clipId: string) => {
    if (!timeline) return;
    
    // 保存原始timeline用于回滚
    const originalTimeline = timeline;
    
    try {
      // 乐观更新：立即从本地状态中移除片段
      const remainingClips = timeline.clips.filter(clip => clip.id !== clipId);
      
      // 重新计算位置（波纹效果）
      const reorderData = recalculateClipPositions(remainingClips);
      const optimisticClips = remainingClips.map((clip) => {
        const reorderItem = reorderData.find(r => r.clipId === clip.id);
        return {
          ...clip,
          startTime: reorderItem?.startTime ?? clip.startTime,
          order: reorderItem?.order ?? clip.order,
        };
      });
      
      // 计算新的总时长
      const newDuration = optimisticClips.length > 0
        ? optimisticClips[optimisticClips.length - 1].startTime + 
          optimisticClips[optimisticClips.length - 1].duration
        : 0;
      
      // 立即更新UI（乐观更新）
      updateTimeline({
        ...timeline,
        clips: optimisticClips,
        duration: newDuration,
      });
      
      // 调用API删除
      const result = await removeClip(clipId);
      
      if (result.success && result.timeline) {
        // API成功，使用服务器返回的数据
        updateTimeline(result.timeline);
      } else {
        // API失败，回滚
        updateTimeline(originalTimeline);
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      // 出错时回滚
      updateTimeline(originalTimeline);
      console.error("删除片段失败:", error);
      toast.error("删除失败");
    }
  };

  // 片段拖拽开始
  const handleClipDragStart = (clipId: string) => {
    setDraggedClipId(clipId);
  };

  // 片段拖拽结束 - 重新排序
  const handleClipDragEnd = async (clipId: string, newStartTime: number) => {
    setDraggedClipId(null);
    
    if (!timeline) return;
    
    setIsReordering(true);
    
    // 保存原始timeline用于回滚
    const originalTimeline = timeline;
    
    try {
      // 创建新的片段数组副本并更新拖拽片段的位置
      const updatedClips = timeline.clips.map((clip) => 
        clip.id === clipId 
          ? { ...clip, startTime: newStartTime } 
          : clip
      );
      
      // 按照新的 startTime 排序
      updatedClips.sort((a, b) => a.startTime - b.startTime);
      
      // 重新计算所有片段的 order 和 startTime（连续排列）
      const reorderData = recalculateClipPositions(updatedClips);
      
      // 乐观更新：立即更新本地状态
      const optimisticClips = updatedClips.map((clip, index) => {
        const reorderItem = reorderData.find(r => r.clipId === clip.id);
        return {
          ...clip,
          startTime: reorderItem?.startTime ?? clip.startTime,
          order: reorderItem?.order ?? index,
        };
      });
      
      // 计算新的总时长
      const newDuration = optimisticClips.length > 0
        ? optimisticClips[optimisticClips.length - 1].startTime + 
          optimisticClips[optimisticClips.length - 1].duration
        : 0;
      
      // 立即更新UI（乐观更新）
      updateTimeline({
        ...timeline,
        clips: optimisticClips,
        duration: newDuration,
      });
      
      // 调用 API 更新
      const result = await reorderClips(timeline.id, reorderData);
      
      if (result.success && result.timeline) {
        // API成功，使用服务器返回的数据确保一致性
        updateTimeline(result.timeline);
      } else {
        // API失败，回滚到原始状态
        updateTimeline(originalTimeline);
        toast.error(result.error || "重排序失败");
      }
    } catch (error) {
      // 出错时回滚
      updateTimeline(originalTimeline);
      console.error("重排序失败:", error);
      toast.error("重排序失败");
    } finally {
      setIsReordering(false);
    }
  };

  // 裁剪预览（拖拽过程中实时更新）
  const handleClipTrimming = (clipId: string, newDuration: number) => {
    if (!timeline) return;
    
    // 查找片段
    const clip = timeline.clips.find(c => c.id === clipId);
    
    // 如果时长没有变化，清除预览状态
    if (clip && Math.abs(newDuration - clip.duration) < 10) {
      setTrimmingClipInfo(null);
    } else {
      setTrimmingClipInfo({ clipId, newDuration });
    }
  };

  // 更新片段裁剪
  const handleClipTrim = async (
    clipId: string,
    trimStart: number,
    duration: number
  ) => {
    if (!timeline) return;
    
    // 清除裁剪预览状态
    setTrimmingClipInfo(null);
    
    // 保存原始timeline用于回滚
    const originalTimeline = timeline;
    
    try {
      // 乐观更新：立即更新本地状态
      const optimisticClips = timeline.clips.map((clip) =>
        clip.id === clipId
          ? { ...clip, trimStart, duration }
          : clip
      );
      
      // 重新计算波纹效果后的位置
      const reorderData = recalculateClipPositions(optimisticClips);
      const finalClips = optimisticClips.map((clip) => {
        const reorderItem = reorderData.find(r => r.clipId === clip.id);
        return {
          ...clip,
          startTime: reorderItem?.startTime ?? clip.startTime,
          order: reorderItem?.order ?? clip.order,
        };
      });
      
      // 计算新的总时长
      const newDuration = finalClips.length > 0
        ? finalClips[finalClips.length - 1].startTime + 
          finalClips[finalClips.length - 1].duration
        : 0;
      
      // 立即更新UI（乐观更新）
      updateTimeline({
        ...timeline,
        clips: finalClips,
        duration: newDuration,
      });
      
      // 1. 更新片段的裁剪参数
      const result = await updateClip(clipId, {
        trimStart,
        duration,
      });

      if (result.success && result.timeline) {
        // 2. 应用波纹效果 - 重新整理所有片段
        const reorderData = recalculateClipPositions(result.timeline.clips);
        const rippleResult = await reorderClips(result.timeline.id, reorderData);
        
        if (rippleResult.success && rippleResult.timeline) {
          // API成功，使用服务器返回的数据
          updateTimeline(rippleResult.timeline);
        } else {
          // 重排失败，但裁剪成功
          updateTimeline(result.timeline);
          toast.warning("片段已裁剪，但自动整理失败");
        }
      } else {
        // 裁剪失败，回滚
        updateTimeline(originalTimeline);
        toast.error(result.error || "裁剪失败");
      }
    } catch (error) {
      // 出错时回滚
      updateTimeline(originalTimeline);
      console.error("裁剪失败:", error);
      toast.error("裁剪失败");
    }
  };

  // 缩放控制
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 0.2));
  };

  // 处理添加素材
  const handleAddAsset = async (asset: AssetWithRuntimeStatus) => {
    if (!timeline) return;

    // 计算新片段的开始时间（添加到时间轴末尾）
    let startTime = 0;
    if (timeline.clips.length > 0) {
      const lastClip = timeline.clips[timeline.clips.length - 1];
      startTime = lastClip.startTime + lastClip.duration;
    }

    // 添加片段到时间轴
    const result = await addClipToTimeline(timeline.id, {
      assetId: asset.id,
      trackIndex: 0,
      startTime,
      duration: asset.duration || 0,
      trimStart: 0,
    });

    if (result.success && result.timeline) {
      updateTimeline(result.timeline);
      toast.success("已添加到时间轴");
    } else {
      toast.error(result.error || "添加失败");
    }
  };

  // 生成时间标尺
  const generateTimeRuler = () => {
    const totalWidth = (timeline.duration || 10000) * pixelsPerMs;
    const stepMs = 5000; // 每5秒一个标记
    const marks: { time: number; label: string }[] = [];

    for (let time = 0; time <= timeline.duration; time += stepMs) {
      marks.push({
        time,
        label: `${Math.floor(time / 1000)}s`,
      });
    }

    return { totalWidth, marks };
  };

  const { totalWidth, marks } = generateTimeRuler();

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 工具栏 */}
      <div className="h-12 border-b flex items-center justify-between px-4 gap-3 shrink-0">
        {/* 左侧：添加素材 */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="text-xs">添加素材</span>
          </Button>
        </div>
        
        {/* 中央：播放控制按钮组 */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={skipToPrevious}
            disabled={!currentClip}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={togglePlayPause}
            disabled={!currentClip}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={skipToNext}
            disabled={!currentClip}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
        
        {/* 右侧：时间显示和缩放控制 */}
        <div className="flex items-center gap-3">
          {/* 时间显示 */}
          <div className="text-xs text-muted-foreground font-mono">
            {formatTimeDisplay(currentTime)} / {formatTimeDisplay(timeline.duration)}
          </div>
          
          {/* 缩放控制 */}
          <div className="flex items-center gap-1 border-l pl-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleZoomOut}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleZoomIn}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 时间轴主体 */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="pl-2">
          {/* 时间标尺 */}
          <div 
            ref={timelineRulerRef}
            className={`relative h-8 border-b mb-1.5 mr-4 transition-colors ${
              isDraggingPlayhead 
                ? 'cursor-grabbing' 
                : 'cursor-grab hover:bg-muted/20'
            }`}
            style={{ width: totalWidth }}
            onMouseDown={handleTimelineMouseDown}
          >
            {marks.map((mark) => (
              <div
                key={mark.time}
                className="absolute top-0 h-full"
                style={{ left: mark.time * pixelsPerMs }}
              >
                <div className="w-px h-2 bg-border" />
                <span className={`absolute top-2 text-xs text-muted-foreground ${
                  mark.time === 0 ? 'left-0' : 'left-0 -translate-x-1/2'
                }`}>
                  {mark.label}
                </span>
              </div>
            ))}
            
            {/* 播放头指示器 */}
            <div
              className="absolute z-10 pointer-events-none"
              style={{ 
                left: currentTime * pixelsPerMs,
                top: 0,
                transform: 'translateX(-50%)',
              }}
            >
              {/* 顶部三角形 */}
              <svg
                className="absolute left-1/2 -translate-x-1/2 top-0"
                width="10"
                height="7"
                viewBox="0 0 10 7"
                style={{
                  filter: 'drop-shadow(0 0.5px 1.5px rgba(0,0,0,0.15))',
                }}
              >
                <path
                  d="M5 7 L0 0 L10 0 Z"
                  className="fill-primary/95"
                />
              </svg>
              
              {/* 指示线 */}
              <div 
                className="w-px absolute left-1/2 -translate-x-1/2 bg-primary/40"
                style={{ 
                  height: 'calc(100vh - 120px)',
                  top: '7px',
                }}
              />
            </div>
          </div>

          {/* 轨道 */}
          <div
            ref={trackRef}
            className="relative h-24 mr-4"
            style={{ width: Math.max(totalWidth, 800) }}
          >
            {timeline.clips.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                点击左上角&ldquo;添加素材&rdquo;按钮添加视频片段
              </div>
            ) : (
              timeline.clips.map((clip, index) => {
                // 计算裁剪预览时的临时位置
                let temporaryStartTime = clip.startTime;
                
                if (trimmingClipInfo) {
                  // 找到正在裁剪的片段的索引
                  const trimmingIndex = timeline.clips.findIndex(
                    c => c.id === trimmingClipInfo.clipId
                  );
                  
                  // 如果当前片段在正在裁剪的片段之后
                  if (trimmingIndex !== -1 && index > trimmingIndex) {
                    const trimmingClip = timeline.clips[trimmingIndex];
                    const durationDiff = trimmingClipInfo.newDuration - trimmingClip.duration;
                    
                    // 根据时长差调整后续片段的位置
                    temporaryStartTime = clip.startTime + durationDiff;
                  }
                }
                
                return (
                  <TimelineClipItem
                    key={clip.id}
                    clip={clip}
                    allClips={timeline.clips}
                    pixelsPerMs={pixelsPerMs}
                    trackRef={trackRef}
                    temporaryStartTime={temporaryStartTime}
                    onDelete={() => handleDeleteClip(clip.id)}
                    onDragStart={() => handleClipDragStart(clip.id)}
                    onDragEnd={handleClipDragEnd}
                    onTrimming={handleClipTrimming}
                    onTrim={handleClipTrim}
                    isDragging={draggedClipId === clip.id}
                    disabled={isReordering}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 添加素材对话框 */}
      <AddAssetDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSelect={handleAddAsset}
      />
    </div>
  );
}

