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
import { useTranslations } from "next-intl";
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
 * Validate asset type matches track type
 * @returns Error key if validation fails, otherwise null
 */
function validateAssetTrackCompatibility(
  asset: AssetWithFullData,
  trackIndex: number
): "videoTrackVideoOnly" | "audioTrackAudioOnly" | null {
  const isVideo = asset.assetType === "video";
  const isAudio = asset.assetType === "audio";
  const targetIsVideoTrack = isVideoTrack(trackIndex);

  if (targetIsVideoTrack && !isVideo) {
    return "videoTrackVideoOnly";
  }
  if (!targetIsVideoTrack && !isAudio) {
    return "audioTrackAudioOnly";
  }
  return null;
}

/**
 * Timeline panel component
 */
export function TimelinePanel(props: TimelinePanelProps) {
  return (
    <TimelineDragProvider>
      <TimelinePanelContent {...props} />
    </TimelineDragProvider>
  );
}

/**
 * Timeline panel internal component
 */
function TimelinePanelContent({
  playback,
  trackStates,
  onToggleTrackMute,
  onPreviewAsset,
}: TimelinePanelProps) {
  const { state, updateTimeline } = useEditor();
  const { timeline } = state;
  const t = useTranslations("editor.timeline");
  const tToasts = useTranslations("toasts");

  // Drag state
  const {
    isDragging,
    draggedAsset,
    dropTargetTrack,
    dropPosition,
    setDropTarget,
    resetDrag,
  } = useTimelineDrag();

  // Refs to store latest drag state values (avoid frequent useEffect re-runs)
  const dropTargetTrackRef = useRef(dropTargetTrack);
  const draggedAssetRef = useRef(draggedAsset);
  const dropPositionRef = useRef(dropPosition);

  const [zoom, setZoom] = useState(1); // Zoom level
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
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
  const THROTTLE_MS = 32; // ~30fps, give video loading more time

  // Get playback controls from playback prop
  const {
    isPlaying,
    currentTime,
    currentTimeRef,
    togglePlayPause,
    seek,
    pause,
  } = playback;

  const pixelsPerMs = 0.1 * zoom; // Pixels per millisecond

  // Get track configuration from timeline metadata
  const tracks = useMemo(() => {
    return getTimelineTracks(timeline?.metadata);
  }, [timeline?.metadata]);

  // Separate video and audio tracks
  const videoTracks = useMemo(() => getVideoTracks(tracks), [tracks]);
  const audioTracks = useMemo(() => getAudioTracks(tracks), [tracks]);

  // Handle resolution change
  const handleResolutionChange = useCallback(async (newResolution: string) => {
    if (!timeline) return;
    const result = await updateTimelineAction(timeline.id, { resolution: newResolution });
    if (result.success && result.timeline) {
      updateTimeline(result.timeline);
    } else {
      toast.error(tToasts("error.resolutionUpdateFailed"));
    }
  }, [timeline, updateTimeline, tToasts]);

  // Group clips by track
  const clipsByTrack = useMemo(() => {
    if (!timeline) return new Map<number, TimelineClipWithAsset[]>();
    return groupClipsByTrack(timeline.clips);
  }, [timeline]);

  // Timeline ruler mouse down - start dragging or seeking
  const handleTimelineMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRulerRef.current || !timeline) return;
    
    e.preventDefault();
    pause(); // Pause playback on mouse down

    const rect = timelineRulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(clickX / pixelsPerMs, timeline.duration));

    // Immediately seek to click position
    seek(newTime);

    // Start drag mode
    setIsDraggingPlayhead(true);
  }, [pause, pixelsPerMs, timeline, seek]);

  // Mouse move handler (dragging playhead) - with throttling
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingPlayhead || !timelineRulerRef.current || !timeline) return;

    // Throttle: limit update frequency
    const now = performance.now();
    if (now - lastSeekTimeRef.current < THROTTLE_MS) return;
    lastSeekTimeRef.current = now;

    const rect = timelineRulerRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(offsetX / pixelsPerMs, timeline.duration));

    seek(newTime);
  }, [isDraggingPlayhead, pixelsPerMs, timeline, seek]);

  // Mouse release handler
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

  // Sync refs with latest drag state values
  useEffect(() => {
    dropTargetTrackRef.current = dropTargetTrack;
  }, [dropTargetTrack]);

  useEffect(() => {
    draggedAssetRef.current = draggedAsset;
  }, [draggedAsset]);

  useEffect(() => {
    dropPositionRef.current = dropPosition;
  }, [dropPosition]);

  // 素材拖拽释放监听 - 使用 ref 避免频繁替换监听器
  useEffect(() => {
    if (!isDragging) return;

    const handleAssetDragEnd = async () => {
      if (dropTargetTrackRef.current !== null && draggedAssetRef.current && dropPositionRef.current !== null) {
        await handleAssetDropFromDrag(draggedAssetRef.current, dropTargetTrackRef.current, dropPositionRef.current);
      }
      resetDrag();
    };

    window.addEventListener("mouseup", handleAssetDragEnd);
    return () => window.removeEventListener("mouseup", handleAssetDragEnd);
  }, [isDragging, resetDrag]);

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
      toast.error(t(`errors.${validationError}`));
      return;
    }

    // Add clip to timeline
    const result = await addClipToTimeline(timeline.id, {
      assetId: asset.id,
      trackIndex,
      startTime: Math.round(startTime),
      duration: asset.duration || 0,
      trimStart: 0,
    });

    if (result.success && result.timeline) {
      updateTimeline(result.timeline);
      toast.success(tToasts("success.timelineClipAdded"));
    } else {
      toast.error(result.error || tToasts("error.addFailed"));
    }
  };

  // Find current clip index based on current time
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

  // Skip to previous clip
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

  // Skip to next clip
  const skipToNext = () => {
    if (!timeline) return;
    const videoClips = timeline.clips.filter((c) => c.trackIndex < 100);
    const currentIndex = findCurrentClipIndex();
    if (currentIndex >= 0 && currentIndex < videoClips.length - 1) {
      seek(videoClips[currentIndex + 1].startTime);
    }
  };

  // Delete clip
  const handleDeleteClip = async (clipId: string) => {
    if (!timeline) return;

    // Save original timeline for rollback
    const originalTimeline = timeline;

    // Get deleted clip's track info
    const deletedClip = timeline.clips.find(clip => clip.id === clipId);
    if (!deletedClip) return;

    const deletedTrackIndex = deletedClip.trackIndex;

    try {
      // Optimistic update: immediately remove clip from local state
      const remainingClips = timeline.clips.filter(clip => clip.id !== clipId);

      let optimisticClips: TimelineClipWithAsset[];

      if (isAudioTrack(deletedTrackIndex)) {
        // Audio track: free positioning mode, no ripple reordering
        optimisticClips = remainingClips;
      } else {
        // Video track: ripple reorder only this track's clips
        const reorderData = recalculateTrackClipPositions(remainingClips, deletedTrackIndex);
        optimisticClips = remainingClips.map((clip) => {
          if (clip.trackIndex !== deletedTrackIndex) {
            return clip; // Other tracks' clips remain unchanged
          }
          const reorderItem = reorderData.find(r => r.clipId === clip.id);
          return {
            ...clip,
            startTime: reorderItem?.startTime ?? clip.startTime,
            order: reorderItem?.order ?? clip.order,
          };
        });
      }

      // Calculate new total duration (based on max end time of all clips)
      const newDuration = optimisticClips.length > 0
        ? Math.max(...optimisticClips.map(c => c.startTime + c.duration))
        : 0;

      // Immediately update UI (optimistic update)
      updateTimeline({
        ...timeline,
        clips: optimisticClips,
        duration: newDuration,
      });

      // Call API to delete
      const result = await removeClip(clipId);

      if (result.success && result.timeline) {
        // API success, use server-returned data
        updateTimeline(result.timeline);
      } else {
        // API failed, rollback
        updateTimeline(originalTimeline);
        toast.error(result.error || tToasts("error.deleteFailed"));
      }
    } catch (error) {
      // Rollback on error
      updateTimeline(originalTimeline);
      console.error("Failed to delete clip:", error);
      toast.error(tToasts("error.deleteFailed"));
    }
  };

  // Clip selection - toggle on/off
  const handleClipSelect = (clipId: string) => {
    setSelectedClipId(prev => prev === clipId ? null : clipId);
  };

  // Keyboard event handler for Delete key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete or Backspace key
      if ((e.key === "Delete" || e.key === "Backspace") && selectedClipId) {
        // Prevent default browser behavior
        e.preventDefault();
        // Delete the selected clip
        handleDeleteClip(selectedClipId);
        // Clear selection
        setSelectedClipId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedClipId]); // Re-attach listener when selectedClipId changes

  // Clip drag start
  const handleClipDragStart = (clipId: string) => {
    setDraggedClipId(clipId);
  };

  // Clip drag end - reorder
  const handleClipDragEnd = async (clipId: string, newStartTime: number) => {
    setDraggedClipId(null);

    if (!timeline) return;

    // Get dragged clip's track info
    const draggedClip = timeline.clips.find(clip => clip.id === clipId);
    if (!draggedClip) return;

    const draggedTrackIndex = draggedClip.trackIndex;

    setIsReordering(true);

    // Save original timeline for rollback
    const originalTimeline = timeline;

    try {
      // Create new clips array copy and update dragged clip's position
      const updatedClips = timeline.clips.map((clip) =>
        clip.id === clipId
          ? { ...clip, startTime: newStartTime }
          : clip
      );

      let optimisticClips: TimelineClipWithAsset[];
      let reorderData: Array<{ clipId: string; order: number; startTime: number }>;

      if (isAudioTrack(draggedTrackIndex)) {
        // Audio track: free positioning mode, only update this clip's startTime, doesn't affect other clips
        optimisticClips = updatedClips;
        reorderData = [{ clipId, order: draggedClip.order, startTime: Math.round(newStartTime) }];
      } else {
        // Video track: ripple reorder this track
        // First sort this track's clips by new startTime
        const trackClips = updatedClips
          .filter(c => c.trackIndex === draggedTrackIndex)
          .sort((a, b) => a.startTime - b.startTime);

        // Recalculate this track's clips' order and startTime (continuous arrangement)
        reorderData = recalculateTrackClipPositions(
          trackClips.map((clip, idx) => ({ ...clip, order: idx })),
          draggedTrackIndex
        );

        // Apply reorder results to optimistic update
        optimisticClips = updatedClips.map((clip) => {
          if (clip.trackIndex !== draggedTrackIndex) {
            return clip; // Other tracks' clips remain unchanged
          }
          const reorderItem = reorderData.find(r => r.clipId === clip.id);
          return {
            ...clip,
            startTime: reorderItem?.startTime ?? clip.startTime,
            order: reorderItem?.order ?? clip.order,
          };
        });
      }

      // Calculate new total duration (based on max end time of all clips)
      const newDuration = optimisticClips.length > 0
        ? Math.max(...optimisticClips.map(c => c.startTime + c.duration))
        : 0;

      // Immediately update UI (optimistic update)
      updateTimeline({
        ...timeline,
        clips: optimisticClips,
        duration: newDuration,
      });

      // Call API to update
      const result = await reorderClips(timeline.id, reorderData);

      if (result.success && result.timeline) {
        // API success, use server-returned data to ensure consistency
        updateTimeline(result.timeline);
      } else {
        // API failed, rollback to original state
        updateTimeline(originalTimeline);
        toast.error(result.error || tToasts("error.reorderFailed"));
      }
    } catch (error) {
      // Rollback on error
      updateTimeline(originalTimeline);
      console.error("Failed to reorder:", error);
      toast.error(tToasts("error.reorderFailed"));
    } finally {
      setIsReordering(false);
    }
  };

  // Trim preview (real-time update during dragging)
  const handleClipTrimming = (clipId: string, newDuration: number) => {
    if (!timeline) return;

    // Find clip
    const clip = timeline.clips.find(c => c.id === clipId);

    // If duration hasn't changed, clear preview state
    if (clip && Math.abs(newDuration - clip.duration) < 10) {
      setTrimmingClipInfo(null);
    } else {
      setTrimmingClipInfo({ clipId, newDuration });
    }
  };

  // Update clip trim
  const handleClipTrim = async (
    clipId: string,
    trimStart: number,
    duration: number
  ) => {
    if (!timeline) return;

    // Clear trim preview state
    setTrimmingClipInfo(null);

    // Get trimmed clip's track info
    const trimmedClip = timeline.clips.find(clip => clip.id === clipId);
    if (!trimmedClip) return;

    const trimmedTrackIndex = trimmedClip.trackIndex;

    // Save original timeline for rollback
    const originalTimeline = timeline;

    try {
      // Optimistic update: immediately update local state
      const updatedClips = timeline.clips.map((clip) =>
        clip.id === clipId
          ? { ...clip, trimStart, duration }
          : clip
      );

      let finalClips: TimelineClipWithAsset[];

      if (isAudioTrack(trimmedTrackIndex)) {
        // Audio track: free positioning mode, no ripple reordering
        finalClips = updatedClips;
      } else {
        // Video track: ripple reorder only this track
        const reorderData = recalculateTrackClipPositions(updatedClips, trimmedTrackIndex);
        finalClips = updatedClips.map((clip) => {
          if (clip.trackIndex !== trimmedTrackIndex) {
            return clip; // Other tracks' clips remain unchanged
          }
          const reorderItem = reorderData.find(r => r.clipId === clip.id);
          return {
            ...clip,
            startTime: reorderItem?.startTime ?? clip.startTime,
            order: reorderItem?.order ?? clip.order,
          };
        });
      }

      // Calculate new total duration (based on max end time of all clips)
      const newDuration = finalClips.length > 0
        ? Math.max(...finalClips.map(c => c.startTime + c.duration))
        : 0;

      // Immediately update UI (optimistic update)
      updateTimeline({
        ...timeline,
        clips: finalClips,
        duration: newDuration,
      });

      // 1. Update clip's trim parameters
      const result = await updateClip(clipId, {
        trimStart,
        duration,
      });

      if (result.success && result.timeline) {
        if (isAudioTrack(trimmedTrackIndex)) {
          // Audio track: no ripple reordering needed, use returned result directly
          updateTimeline(result.timeline);
        } else {
          // Video track: apply ripple effect - reorder only this track's clips
          const reorderData = recalculateTrackClipPositions(result.timeline.clips, trimmedTrackIndex);
          const rippleResult = await reorderClips(result.timeline.id, reorderData);

          if (rippleResult.success && rippleResult.timeline) {
            // API success, use server-returned data
            updateTimeline(rippleResult.timeline);
          } else {
            // Reorder failed, but trim succeeded
            updateTimeline(result.timeline);
            toast.warning(tToasts("warning.clipTrimmedButAutoArrangeFailed"));
          }
        }
      } else {
        // Trim failed, rollback
        updateTimeline(originalTimeline);
        toast.error(result.error || tToasts("error.trimFailed"));
      }
    } catch (error) {
      // Rollback on error
      updateTimeline(originalTimeline);
      console.error("Failed to trim:", error);
      toast.error(tToasts("error.trimFailed"));
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 0.2));
  };

  // Slider zoom control (convert zoom to 20-500 integer range)
  const handleZoomChange = (value: number[]) => {
    setZoom(value[0] / 100);
  };

  // Add audio track
  const handleAddAudioTrack = async () => {
    if (!timeline) return;

    const newTracks = addTrackToConfig(tracks, "audio");
    const result = await updateTimelineTracks(timeline.id, newTracks);

    if (result.success && result.timeline) {
      updateTimeline(result.timeline);
      toast.success(tToasts("success.audioTrackAdded"));
    } else {
      toast.error(result.error || tToasts("error.addTrackFailed"));
    }
  };

  // Delete track
  const handleDeleteTrack = async (trackIndex: number) => {
    if (!timeline) return;

    // Check if track has clips
    const trackClips = clipsByTrack.get(trackIndex) || [];
    if (trackClips.length > 0) {
      toast.error(t("errors.cannotDeleteNonEmptyTrack"));
      return;
    }

    // Check if it's the last track of this type
    const track = tracks.find((t) => t.index === trackIndex);
    if (!track) return;

    const sameTypeTracks = tracks.filter((t) => t.type === track.type);
    if (sameTypeTracks.length <= 1) {
      toast.error(t("errors.mustKeepOneTrack", { type: t(track.type) }));
      return;
    }

    const newTracks = removeTrackFromConfig(tracks, trackIndex);
    const result = await updateTimelineTracks(timeline.id, newTracks);

    if (result.success && result.timeline) {
      updateTimeline(result.timeline);
      toast.success(tToasts("success.trackDeleted"));
    } else {
      toast.error(result.error || tToasts("error.deleteTrackFailed"));
    }
  };

  // Calculate tick interval based on zoom level
  const getTimeStepByZoom = (zoomLevel: number): number => {
    if (zoomLevel < 0.5) return 10000;  // 10s
    if (zoomLevel < 1) return 5000;     // 5s
    if (zoomLevel < 2) return 2000;     // 2s
    if (zoomLevel < 3) return 1000;     // 1s
    return 500;                     // 0.5s
  };

  // Use useMemo to cache timeline ruler calculation
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

  // Validate if drop target is valid (type matches)
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
      {/* Toolbar */}
      <div className="h-12 border-b flex items-center justify-between px-4 gap-3 shrink-0">
        {/* Left: Resolution selector */}
        <div className="flex items-center gap-3">
          <ResolutionSelector
            value={timeline.resolution}
            onValueChange={handleResolutionChange}
          />
        </div>

        {/* Center: Playback control buttons */}
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

        {/* Right: Time display and zoom controls */}
        <div className="flex items-center gap-3">
          {/* Time display */}
          <div className="text-xs text-muted-foreground font-mono">
            {formatTimeDisplay(currentTime)} / {formatTimeDisplay(timeline.duration)}
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-2 border-l pl-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleZoomOut}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>

            {/* Zoom slider */}
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

          {/* Export button */}
          <Button
            variant="default"
            size="sm"
            className="h-7 gap-1.5 border-l ml-3 pl-3"
            onClick={() => setIsExportDialogOpen(true)}
            disabled={timeline.clips.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            {t("export")}
          </Button>
        </div>
      </div>

      {/* Asset strip */}
      <AssetStripPanel
        onPreviewAsset={onPreviewAsset}
      />

      {/* Timeline body */}
      <div ref={timelineBodyRef} className="flex-1 overflow-auto">
        <div className="flex">
          {/* Left: Track headers */}
          <div className="w-28 shrink-0 border-r bg-muted/30">
            {/* Timeline ruler placeholder */}
            <div className="h-8 border-b" />

            {/* Video track area */}
            {videoTracks.map((track) => {
              const trackClips = clipsByTrack.get(track.index) || [];
              const canDelete = videoTracks.length > 1 && trackClips.length === 0;

              return (
                <div
                  key={track.index}
                  className="border-b flex items-center justify-between px-2 group"
                  style={{ height: track.height }}
                >
                  {/* Track name and icon */}
                  <div className="flex items-center gap-1.5">
                    <Video className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium truncate">{track.name}</span>
                  </div>
                  {/* Delete button */}
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

            {/* Video/Audio separator */}
            <div className="h-px bg-border" />

            {/* Audio track area */}
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
                  {/* Track name and controls */}
                  <div className="flex items-center gap-1.5">
                    <AudioLines className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium truncate">{track.name}</span>
                    {/* Mute button */}
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
                  {/* Delete button */}
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

            {/* Add audio track button */}
            <div className="h-7 border-b flex items-center justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-xs gap-1 px-2 text-muted-foreground hover:text-foreground"
                onClick={handleAddAudioTrack}
              >
                <Plus className="h-3 w-3" />
                {t("audioTrack")}
              </Button>
            </div>
          </div>

          {/* Right: Track content area */}
          <div className="flex-1 overflow-x-auto">
            <div className="pl-2">
              {/* Timeline ruler */}
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

                {/* Playhead indicator */}
                <div
                  ref={playheadRef}
                  className="absolute z-10 pointer-events-none"
                  style={{
                    left: currentTime * pixelsPerMs,
                    top: 0,
                    transform: 'translateX(-50%)',
                  }}
                >
                  {/* Top triangle */}
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

                  {/* Indicator line - height covers all tracks */}
                  <div
                    className="w-px absolute left-1/2 -translate-x-1/2 bg-primary/40"
                    style={{
                      height: tracks.reduce((sum, t) => sum + t.height, 0) + 16 + 28, // Add height of add track button
                      top: '7px',
                    }}
                  />
                </div>
              </div>

              {/* Multi-track */}
              <div ref={trackRef}>
                {/* Video track area */}
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
                      {/* Insert position indicator */}
                      {isDropTarget && validDrop && dropPosition !== null && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-primary z-20"
                          style={{ left: dropPosition * pixelsPerMs }}
                        />
                      )}

                      {/* Empty track hint */}
                      {trackClips.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs text-muted-foreground/50">
                            {t("dragToAddVideo")}
                          </span>
                        </div>
                      )}

                      {/* Render clips for this track */}
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
                            onSelect={() => handleClipSelect(clip.id)}
                            isSelected={selectedClipId === clip.id}
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

                {/* Video/Audio separator */}
                <div className="h-px bg-border mr-4" />

                {/* Audio track area */}
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
                      {/* Insert position indicator */}
                      {isDropTarget && validDrop && dropPosition !== null && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-primary z-20"
                          style={{ left: dropPosition * pixelsPerMs }}
                        />
                      )}

                      {/* Empty track hint */}
                      {trackClips.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs text-muted-foreground/50">
                            {t("dragToAddAudio")}
                          </span>
                        </div>
                      )}

                      {/* Render clips for this track */}
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
                            onSelect={() => handleClipSelect(clip.id)}
                            isSelected={selectedClipId === clip.id}
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

                {/* Add audio track button placeholder */}
                <div className="h-7 border-b mr-4" style={{ width: Math.max(totalWidth, 800) }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Export dialog */}
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

