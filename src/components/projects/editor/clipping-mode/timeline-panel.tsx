"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useEditor } from "../editor-context";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  ZoomIn,
  ZoomOut,
  Plus,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Video,
  AudioLines,
  Volume2,
  VolumeX,
  Trash2,
  Download,
} from "lucide-react";
import { TimelineClipItem } from "./timeline-clip-item";
import { AudioClipItem } from "./audio-clip-item";
import { AssetStripPanel } from "./asset-strip-panel";
import { TimelineDragProvider, useTimelineDrag } from "./timeline-drag-context";
import { cn } from "@/lib/utils";
import { addClipToTimeline, removeClip, reorderClips, updateClip, updateTimelineTracks, updateTimeline as updateTimelineAction } from "@/lib/actions/timeline";
import { ResolutionSelector } from "./resolution-selector";
import { ExportDialog } from "./export-dialog";
import { toast } from "sonner";
import { AssetWithFullData } from "@/types/asset";
import {
  recalculateTrackClipPositions,
  formatTimeDisplay,
  groupClipsByTrack,
} from "@/lib/utils/timeline-utils";
import { UseRemotionPlaybackReturn } from "@/hooks/use-remotion-playback";
import {
  TrackStates,
  isVideoTrack,
  isAudioTrack,
  TimelineClipWithAsset,
  getTimelineTracks,
  getVideoTracks,
  getAudioTracks,
  addTrackToConfig,
  removeTrackFromConfig,
} from "@/types/timeline";

interface TimelinePanelProps {
  playback: UseRemotionPlaybackReturn;
  trackStates: TrackStates;
  onToggleTrackMute: (trackIndex: number) => void;
  onPreviewAsset?: (asset: AssetWithFullData) => void;
}

/**
 * 验证素材类型与轨道类型是否匹配
 * @returns 如果验证失败返回错误消息，否则返回 null
 */
function validateAssetTrackCompatibility(
  asset: AssetWithFullData,
  trackIndex: number
): string | null {
  const isVideo = asset.assetType === "video";
  const isAudio = asset.assetType === "audio";
  const targetIsVideoTrack = isVideoTrack(trackIndex);

  if (targetIsVideoTrack && !isVideo) {
    return "视频轨道只能添加视频素材";
  }
  if (!targetIsVideoTrack && !isAudio) {
    return "音频轨道只能添加音频素材";
  }
  return null;
}

/**
 * 时间轴面板组件
 */
export function TimelinePanel(props: TimelinePanelProps) {
  return (
    <TimelineDragProvider>
      <TimelinePanelContent {...props} />
    </TimelineDragProvider>
  );
}

/**
 * 时间轴面板内部组件
 */
function TimelinePanelContent({
  playback,
  trackStates,
  onToggleTrackMute,
  onPreviewAsset,
}: TimelinePanelProps) {
  const { state, updateTimeline } = useEditor();
  const { timeline } = state;

  // 拖拽状态
  const {
    isDragging,
    draggedAsset,
    dropTargetTrack,
    dropPosition,
    setDropTarget,
    resetDrag,
  } = useTimelineDrag();

  const [zoom, setZoom] = useState(1); // 缩放级别
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [trimmingClipInfo, setTrimmingClipInfo] = useState<{
    clipId: string;
    newDuration: number;
  } | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const timelineRulerRef = useRef<HTMLDivElement>(null);
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const lastSeekTimeRef = useRef<number>(0);
  const playheadRef = useRef<HTMLDivElement>(null);
  const THROTTLE_MS = 32; // 约 30fps，给视频加载更多时间

  // 从 playback prop 获取播放控制
  const {
    isPlaying,
    currentTime,
    currentTimeRef,
    togglePlayPause,
    seek,
    pause,
  } = playback;

  const pixelsPerMs = 0.1 * zoom; // 每毫秒对应的像素数

  // 从 timeline metadata 获取轨道配置
  const tracks = useMemo(() => {
    return getTimelineTracks(timeline?.metadata);
  }, [timeline?.metadata]);

  // 分离视频和音频轨道
  const videoTracks = useMemo(() => getVideoTracks(tracks), [tracks]);
  const audioTracks = useMemo(() => getAudioTracks(tracks), [tracks]);

  // 分辨率变更处理
  const handleResolutionChange = useCallback(async (newResolution: string) => {
    if (!timeline) return;
    const result = await updateTimelineAction(timeline.id, { resolution: newResolution });
    if (result.success && result.timeline) {
      updateTimeline(result.timeline);
    } else {
      toast.error("更新分辨率失败");
    }
  }, [timeline, updateTimeline]);

  // 按轨道分组片段
  const clipsByTrack = useMemo(() => {
    if (!timeline) return new Map<number, TimelineClipWithAsset[]>();
    return groupClipsByTrack(timeline.clips);
  }, [timeline]);

  // 时间标尺鼠标按下 - 开始拖拽或跳转
  const handleTimelineMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRulerRef.current || !timeline) return;
    
    e.preventDefault();
    pause(); // 按下时暂停播放
    
    const rect = timelineRulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(clickX / pixelsPerMs, timeline.duration));
    
    // 立即跳转到点击位置
    seek(newTime);

    // 启动拖拽模式
    setIsDraggingPlayhead(true);
  }, [pause, pixelsPerMs, timeline, seek]);

  // 鼠标移动处理（拖拽播放头）- 添加节流
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingPlayhead || !timelineRulerRef.current || !timeline) return;

    // 节流：限制更新频率
    const now = performance.now();
    if (now - lastSeekTimeRef.current < THROTTLE_MS) return;
    lastSeekTimeRef.current = now;

    const rect = timelineRulerRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(offsetX / pixelsPerMs, timeline.duration));

    seek(newTime);
  }, [isDraggingPlayhead, pixelsPerMs, timeline, seek]);

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

  // 播放时直接更新播放头 DOM（绕过 React 渲染，提升性能）
  useEffect(() => {
    if (!isPlaying || !currentTimeRef) return;

    let animationId: number;
    const updatePlayhead = () => {
      if (playheadRef.current) {
        const left = currentTimeRef.current * pixelsPerMs;
        playheadRef.current.style.left = `${left}px`;
      }
      animationId = requestAnimationFrame(updatePlayhead);
    };

    animationId = requestAnimationFrame(updatePlayhead);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, pixelsPerMs, currentTimeRef]);

  // 素材拖拽时的鼠标移动监听 - 计算目标轨道
  useEffect(() => {
    if (!isDragging) return;

    const handleAssetDragMove = (e: MouseEvent) => {
      if (!trackRef.current) return;

      // 获取轨道区域的位置
      const trackContainer = trackRef.current;
      const rect = trackContainer.getBoundingClientRect();

      // 检查鼠标是否在轨道区域内
      if (e.clientY < rect.top || e.clientY > rect.bottom || e.clientX < rect.left) {
        setDropTarget(null, null);
        return;
      }

      // 计算鼠标相对于轨道区域的 Y 位置
      const relativeY = e.clientY - rect.top;

      // 遍历轨道，找到鼠标所在的轨道
      let currentY = 0;
      let targetTrack: number | null = null;

      // 视频轨道
      for (const track of videoTracks) {
        if (relativeY >= currentY && relativeY < currentY + track.height) {
          targetTrack = track.index;
          break;
        }
        currentY += track.height;
      }

      // 分隔线 (1px)
      currentY += 1;

      // 音频轨道
      if (targetTrack === null) {
        for (const track of audioTracks) {
          if (relativeY >= currentY && relativeY < currentY + track.height) {
            targetTrack = track.index;
            break;
          }
          currentY += track.height;
        }
      }

      // 计算时间位置
      let timePosition: number | null = null;
      if (targetTrack !== null && timelineBodyRef.current) {
        const scrollLeft = timelineBodyRef.current.scrollLeft;
        const containerRect = timelineBodyRef.current.getBoundingClientRect();
        const mouseX = e.clientX - containerRect.left;
        const totalX = scrollLeft + mouseX - 8; // 减去 padding
        timePosition = Math.max(0, totalX / pixelsPerMs);
      }

      setDropTarget(targetTrack, timePosition);
    };

    window.addEventListener("mousemove", handleAssetDragMove);
    return () => window.removeEventListener("mousemove", handleAssetDragMove);
  }, [isDragging, videoTracks, audioTracks, pixelsPerMs, setDropTarget]);

  // 素材拖拽释放监听
  useEffect(() => {
    if (!isDragging) return;

    const handleAssetDragEnd = async () => {
      if (dropTargetTrack !== null && draggedAsset && dropPosition !== null) {
        await handleAssetDropFromDrag(draggedAsset, dropTargetTrack, dropPosition);
      }
      resetDrag();
    };

    window.addEventListener("mouseup", handleAssetDragEnd);
    return () => window.removeEventListener("mouseup", handleAssetDragEnd);
  }, [isDragging, dropTargetTrack, draggedAsset, dropPosition, resetDrag]);

  // ESC 键取消拖拽
  useEffect(() => {
    if (!isDragging) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        resetDrag();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDragging, resetDrag]);

  // 处理从素材条拖拽添加到时间轴
  const handleAssetDropFromDrag = async (
    asset: AssetWithFullData,
    trackIndex: number,
    startTime: number
  ) => {
    if (!timeline) return;

    const validationError = validateAssetTrackCompatibility(asset, trackIndex);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    // 添加片段到时间轴
    const result = await addClipToTimeline(timeline.id, {
      assetId: asset.id,
      trackIndex,
      startTime: Math.round(startTime),
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

  // 基于当前时间查找当前片段
  const findCurrentClipIndex = () => {
    if (!timeline) return -1;
    const videoClips = timeline.clips.filter((c) => c.trackIndex < 100);
    for (let i = 0; i < videoClips.length; i++) {
      const clip = videoClips[i];
      if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
        return i;
      }
    }
    return -1;
  };

  // 跳转到上一个片段
  const skipToPrevious = () => {
    if (!timeline) return;
    const videoClips = timeline.clips.filter((c) => c.trackIndex < 100);
    const currentIndex = findCurrentClipIndex();
    if (currentIndex > 0) {
      seek(videoClips[currentIndex - 1].startTime);
    } else {
      seek(0);
    }
  };

  // 跳转到下一个片段
  const skipToNext = () => {
    if (!timeline) return;
    const videoClips = timeline.clips.filter((c) => c.trackIndex < 100);
    const currentIndex = findCurrentClipIndex();
    if (currentIndex >= 0 && currentIndex < videoClips.length - 1) {
      seek(videoClips[currentIndex + 1].startTime);
    }
  };

  // 删除片段
  const handleDeleteClip = async (clipId: string) => {
    if (!timeline) return;

    // 保存原始timeline用于回滚
    const originalTimeline = timeline;

    // 获取被删除片段的轨道信息
    const deletedClip = timeline.clips.find(clip => clip.id === clipId);
    if (!deletedClip) return;

    const deletedTrackIndex = deletedClip.trackIndex;

    try {
      // 乐观更新：立即从本地状态中移除片段
      const remainingClips = timeline.clips.filter(clip => clip.id !== clipId);

      let optimisticClips: TimelineClipWithAsset[];

      if (isAudioTrack(deletedTrackIndex)) {
        // 音频轨道：自由定位模式，不进行波纹重排
        optimisticClips = remainingClips;
      } else {
        // 视频轨道：只对该轨道的片段进行波纹重排
        const reorderData = recalculateTrackClipPositions(remainingClips, deletedTrackIndex);
        optimisticClips = remainingClips.map((clip) => {
          if (clip.trackIndex !== deletedTrackIndex) {
            return clip; // 其他轨道的片段保持不变
          }
          const reorderItem = reorderData.find(r => r.clipId === clip.id);
          return {
            ...clip,
            startTime: reorderItem?.startTime ?? clip.startTime,
            order: reorderItem?.order ?? clip.order,
          };
        });
      }

      // 计算新的总时长（基于所有片段的最大结束时间）
      const newDuration = optimisticClips.length > 0
        ? Math.max(...optimisticClips.map(c => c.startTime + c.duration))
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

    // 获取被拖拽片段的轨道信息
    const draggedClip = timeline.clips.find(clip => clip.id === clipId);
    if (!draggedClip) return;

    const draggedTrackIndex = draggedClip.trackIndex;

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

      let optimisticClips: TimelineClipWithAsset[];
      let reorderData: Array<{ clipId: string; order: number; startTime: number }>;

      if (isAudioTrack(draggedTrackIndex)) {
        // 音频轨道：自由定位模式，只更新该片段的 startTime，不影响其他片段
        optimisticClips = updatedClips;
        reorderData = [{ clipId, order: draggedClip.order, startTime: Math.round(newStartTime) }];
      } else {
        // 视频轨道：对该轨道进行波纹重排
        // 先按照新的 startTime 排序该轨道的片段
        const trackClips = updatedClips
          .filter(c => c.trackIndex === draggedTrackIndex)
          .sort((a, b) => a.startTime - b.startTime);

        // 重新计算该轨道片段的 order 和 startTime（连续排列）
        reorderData = recalculateTrackClipPositions(
          trackClips.map((clip, idx) => ({ ...clip, order: idx })),
          draggedTrackIndex
        );

        // 应用重排结果到乐观更新
        optimisticClips = updatedClips.map((clip) => {
          if (clip.trackIndex !== draggedTrackIndex) {
            return clip; // 其他轨道的片段保持不变
          }
          const reorderItem = reorderData.find(r => r.clipId === clip.id);
          return {
            ...clip,
            startTime: reorderItem?.startTime ?? clip.startTime,
            order: reorderItem?.order ?? clip.order,
          };
        });
      }

      // 计算新的总时长（基于所有片段的最大结束时间）
      const newDuration = optimisticClips.length > 0
        ? Math.max(...optimisticClips.map(c => c.startTime + c.duration))
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

    // 获取被裁剪片段的轨道信息
    const trimmedClip = timeline.clips.find(clip => clip.id === clipId);
    if (!trimmedClip) return;

    const trimmedTrackIndex = trimmedClip.trackIndex;

    // 保存原始timeline用于回滚
    const originalTimeline = timeline;

    try {
      // 乐观更新：立即更新本地状态
      const updatedClips = timeline.clips.map((clip) =>
        clip.id === clipId
          ? { ...clip, trimStart, duration }
          : clip
      );

      let finalClips: TimelineClipWithAsset[];

      if (isAudioTrack(trimmedTrackIndex)) {
        // 音频轨道：自由定位模式，不进行波纹重排
        finalClips = updatedClips;
      } else {
        // 视频轨道：只对该轨道进行波纹重排
        const reorderData = recalculateTrackClipPositions(updatedClips, trimmedTrackIndex);
        finalClips = updatedClips.map((clip) => {
          if (clip.trackIndex !== trimmedTrackIndex) {
            return clip; // 其他轨道的片段保持不变
          }
          const reorderItem = reorderData.find(r => r.clipId === clip.id);
          return {
            ...clip,
            startTime: reorderItem?.startTime ?? clip.startTime,
            order: reorderItem?.order ?? clip.order,
          };
        });
      }

      // 计算新的总时长（基于所有片段的最大结束时间）
      const newDuration = finalClips.length > 0
        ? Math.max(...finalClips.map(c => c.startTime + c.duration))
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
        if (isAudioTrack(trimmedTrackIndex)) {
          // 音频轨道：不需要波纹重排，直接使用返回结果
          updateTimeline(result.timeline);
        } else {
          // 视频轨道：应用波纹效果 - 只重排该轨道的片段
          const reorderData = recalculateTrackClipPositions(result.timeline.clips, trimmedTrackIndex);
          const rippleResult = await reorderClips(result.timeline.id, reorderData);

          if (rippleResult.success && rippleResult.timeline) {
            // API成功，使用服务器返回的数据
            updateTimeline(rippleResult.timeline);
          } else {
            // 重排失败，但裁剪成功
            updateTimeline(result.timeline);
            toast.warning("片段已裁剪，但自动整理失败");
          }
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

  // Slider 缩放控制（将 zoom 转换为 20-500 的整数范围）
  const handleZoomChange = (value: number[]) => {
    setZoom(value[0] / 100);
  };

  // 添加音频轨道
  const handleAddAudioTrack = async () => {
    if (!timeline) return;

    const newTracks = addTrackToConfig(tracks, "audio");
    const result = await updateTimelineTracks(timeline.id, newTracks);

    if (result.success && result.timeline) {
      updateTimeline(result.timeline);
      toast.success("已添加音频轨道");
    } else {
      toast.error(result.error || "添加轨道失败");
    }
  };

  // 删除轨道
  const handleDeleteTrack = async (trackIndex: number) => {
    if (!timeline) return;

    // 检查轨道是否有片段
    const trackClips = clipsByTrack.get(trackIndex) || [];
    if (trackClips.length > 0) {
      toast.error("无法删除非空轨道，请先移除轨道上的片段");
      return;
    }

    // 检查是否是最后一个同类型轨道
    const track = tracks.find((t) => t.index === trackIndex);
    if (!track) return;

    const sameTypeTracks = tracks.filter((t) => t.type === track.type);
    if (sameTypeTracks.length <= 1) {
      toast.error(`至少需要保留一个${track.type === "video" ? "视频" : "音频"}轨道`);
      return;
    }

    const newTracks = removeTrackFromConfig(tracks, trackIndex);
    const result = await updateTimelineTracks(timeline.id, newTracks);

    if (result.success && result.timeline) {
      updateTimeline(result.timeline);
      toast.success("已删除轨道");
    } else {
      toast.error(result.error || "删除轨道失败");
    }
  };

  // 根据缩放级别计算刻度间隔
  const getTimeStepByZoom = (zoomLevel: number): number => {
    if (zoomLevel < 0.5) return 10000;  // 10s
    if (zoomLevel < 1) return 5000;     // 5s
    if (zoomLevel < 2) return 2000;     // 2s
    if (zoomLevel < 3) return 1000;     // 1s
    return 500;                     // 0.5s
  };

  // 使用 useMemo 缓存时间标尺计算
  const { totalWidth, marks } = useMemo(() => {
    const duration = timeline?.duration || 10000;
    const totalWidth = duration * pixelsPerMs;
    const stepMs = getTimeStepByZoom(zoom);
    const marks: { time: number; label: string }[] = [];

    for (let time = 0; time <= duration; time += stepMs) {
      let label: string;

      if (zoom >= 2) {
        label = formatTimeDisplay(time);
      } else {
        label = `${Math.floor(time / 1000)}s`;
      }

      marks.push({ time, label });
    }

    return { totalWidth, marks };
  }, [timeline?.duration, pixelsPerMs, zoom]);

  // 验证拖拽目标是否有效（类型匹配）
  const isValidDropTarget = (trackIndex: number): boolean => {
    if (!draggedAsset) return false;
    const isVideo = draggedAsset.assetType === "video";
    const isAudio = draggedAsset.assetType === "audio";
    const targetIsVideo = isVideoTrack(trackIndex);
    return (targetIsVideo && isVideo) || (!targetIsVideo && isAudio);
  };

  if (!timeline) return null;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 工具栏 */}
      <div className="h-12 border-b flex items-center justify-between px-4 gap-3 shrink-0">
        {/* 左侧：分辨率选择 */}
        <div className="flex items-center gap-3">
          <ResolutionSelector
            value={timeline.resolution}
            onValueChange={handleResolutionChange}
          />
        </div>

        {/* 中央：播放控制按钮组 */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={skipToPrevious}
            disabled={timeline.clips.length === 0}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={togglePlayPause}
            disabled={timeline.clips.length === 0}
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
            disabled={timeline.clips.length === 0}
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
          <div className="flex items-center gap-2 border-l pl-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleZoomOut}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            
            {/* 缩放滑块 */}
            <Slider
              value={[zoom * 100]}
              onValueChange={handleZoomChange}
              min={20}
              max={500}
              step={5}
              className="w-24"
            />
            
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleZoomIn}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            
            <span className="text-xs text-muted-foreground w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* 导出按钮 */}
          <Button
            variant="default"
            size="sm"
            className="h-7 gap-1.5 border-l ml-3 pl-3"
            onClick={() => setIsExportDialogOpen(true)}
            disabled={timeline.clips.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            导出
          </Button>
        </div>
      </div>

      {/* 素材条 */}
      <AssetStripPanel
        onPreviewAsset={onPreviewAsset}
      />

      {/* 时间轴主体 */}
      <div ref={timelineBodyRef} className="flex-1 overflow-auto">
        <div className="flex">
          {/* 左侧：轨道头部 */}
          <div className="w-28 shrink-0 border-r bg-muted/30">
            {/* 时间尺占位 */}
            <div className="h-8 border-b" />

            {/* 视频轨道区 */}
            {videoTracks.map((track) => {
              const trackClips = clipsByTrack.get(track.index) || [];
              const canDelete = videoTracks.length > 1 && trackClips.length === 0;

              return (
                <div
                  key={track.index}
                  className="border-b flex items-center justify-between px-2 group"
                  style={{ height: track.height }}
                >
                  {/* 轨道名称和图标 */}
                  <div className="flex items-center gap-1.5">
                    <Video className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium truncate">{track.name}</span>
                  </div>
                  {/* 删除按钮 */}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteTrack(track.index)}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </Button>
                  )}
                </div>
              );
            })}

            {/* 视频/音频分隔线 */}
            <div className="h-px bg-border" />

            {/* 音频轨道区 */}
            {audioTracks.map((track) => {
              const trackState = trackStates[track.index] || { volume: 1, isMuted: false };
              const trackClips = clipsByTrack.get(track.index) || [];
              const canDelete = audioTracks.length > 1 && trackClips.length === 0;

              return (
                <div
                  key={track.index}
                  className="border-b flex items-center justify-between px-2 group"
                  style={{ height: track.height }}
                >
                  {/* 轨道名称和控制 */}
                  <div className="flex items-center gap-1.5">
                    <AudioLines className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium truncate">{track.name}</span>
                    {/* 静音按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => onToggleTrackMute(track.index)}
                    >
                      {trackState.isMuted ? (
                        <VolumeX className="h-3 w-3 text-destructive" />
                      ) : (
                        <Volume2 className="h-3 w-3 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {/* 删除按钮 */}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteTrack(track.index)}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </Button>
                  )}
                </div>
              );
            })}

            {/* 添加音频轨道按钮 */}
            <div className="h-7 border-b flex items-center justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-xs gap-1 px-2 text-muted-foreground hover:text-foreground"
                onClick={handleAddAudioTrack}
              >
                <Plus className="h-3 w-3" />
                音频轨
              </Button>
            </div>
          </div>

          {/* 右侧：轨道内容区域 */}
          <div className="flex-1 overflow-x-auto">
            <div className="pl-2">
              {/* 时间标尺 */}
              <div
                ref={timelineRulerRef}
                className={`relative h-8 border-b mr-4 transition-colors ${
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
                  ref={playheadRef}
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

                  {/* 指示线 - 高度覆盖所有轨道 */}
                  <div
                    className="w-px absolute left-1/2 -translate-x-1/2 bg-primary/40"
                    style={{
                      height: tracks.reduce((sum, t) => sum + t.height, 0) + 16 + 28, // 加上添加轨道按钮的高度
                      top: '7px',
                    }}
                  />
                </div>
              </div>

              {/* 多轨道 */}
              <div ref={trackRef}>
                {/* 视频轨道区 */}
                {videoTracks.map((track) => {
                  const trackClips = clipsByTrack.get(track.index) || [];
                  const isDropTarget = dropTargetTrack === track.index;
                  const validDrop = isDropTarget && isValidDropTarget(track.index);

                  return (
                    <div
                      key={track.index}
                      className={cn(
                        "relative border-b mr-4 transition-colors",
                        isDropTarget && validDrop && "bg-primary/10 border-primary",
                        isDropTarget && !validDrop && "bg-destructive/10 border-destructive"
                      )}
                      style={{
                        height: track.height,
                        width: Math.max(totalWidth, 800),
                      }}
                    >
                      {/* 插入位置指示器 */}
                      {isDropTarget && validDrop && dropPosition !== null && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-primary z-20"
                          style={{ left: dropPosition * pixelsPerMs }}
                        />
                      )}

                      {/* 空轨道提示 */}
                      {trackClips.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs text-muted-foreground/50">
                            拖拽或点击添加视频
                          </span>
                        </div>
                      )}

                      {/* 渲染该轨道的片段 */}
                      {trackClips.map((clip, index) => {
                        let temporaryStartTime = clip.startTime;

                        if (trimmingClipInfo && clip.trackIndex === timeline.clips.find(c => c.id === trimmingClipInfo.clipId)?.trackIndex) {
                          const sameTrackClips = trackClips;
                          const trimmingIndex = sameTrackClips.findIndex(
                            c => c.id === trimmingClipInfo.clipId
                          );

                          if (trimmingIndex !== -1 && index > trimmingIndex) {
                            const trimmingClip = sameTrackClips[trimmingIndex];
                            const durationDiff = trimmingClipInfo.newDuration - trimmingClip.duration;
                            temporaryStartTime = clip.startTime + durationDiff;
                          }
                        }

                        return (
                          <TimelineClipItem
                            key={clip.id}
                            clip={clip}
                            pixelsPerMs={pixelsPerMs}
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
                      })}
                    </div>
                  );
                })}

                {/* 视频/音频分隔线 */}
                <div className="h-px bg-border mr-4" />

                {/* 音频轨道区 */}
                {audioTracks.map((track) => {
                  const trackClips = clipsByTrack.get(track.index) || [];
                  const isDropTarget = dropTargetTrack === track.index;
                  const validDrop = isDropTarget && isValidDropTarget(track.index);

                  return (
                    <div
                      key={track.index}
                      className={cn(
                        "relative border-b mr-4 transition-colors",
                        isDropTarget && validDrop && "bg-primary/10 border-primary",
                        isDropTarget && !validDrop && "bg-destructive/10 border-destructive"
                      )}
                      style={{
                        height: track.height,
                        width: Math.max(totalWidth, 800),
                      }}
                    >
                      {/* 插入位置指示器 */}
                      {isDropTarget && validDrop && dropPosition !== null && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-primary z-20"
                          style={{ left: dropPosition * pixelsPerMs }}
                        />
                      )}

                      {/* 空轨道提示 */}
                      {trackClips.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs text-muted-foreground/50">
                            拖拽或点击添加音频
                          </span>
                        </div>
                      )}

                      {/* 渲染该轨道的片段 */}
                      {trackClips.map((clip, index) => {
                        let temporaryStartTime = clip.startTime;

                        if (trimmingClipInfo && clip.trackIndex === timeline.clips.find(c => c.id === trimmingClipInfo.clipId)?.trackIndex) {
                          const sameTrackClips = trackClips;
                          const trimmingIndex = sameTrackClips.findIndex(
                            c => c.id === trimmingClipInfo.clipId
                          );

                          if (trimmingIndex !== -1 && index > trimmingIndex) {
                            const trimmingClip = sameTrackClips[trimmingIndex];
                            const durationDiff = trimmingClipInfo.newDuration - trimmingClip.duration;
                            temporaryStartTime = clip.startTime + durationDiff;
                          }
                        }

                        return (
                          <AudioClipItem
                            key={clip.id}
                            clip={clip}
                            pixelsPerMs={pixelsPerMs}
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
                      })}
                    </div>
                  );
                })}

                {/* 添加音频轨道按钮占位 */}
                <div className="h-7 border-b mr-4" style={{ width: Math.max(totalWidth, 800) }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 导出对话框 */}
      {state.project && (
        <ExportDialog
          open={isExportDialogOpen}
          onOpenChange={setIsExportDialogOpen}
          timeline={timeline}
          projectId={state.project.id}
        />
      )}
    </div>
  );
}

