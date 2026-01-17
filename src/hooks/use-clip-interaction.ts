"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { validateTrimValues } from "@/lib/utils/timeline-utils";

interface ClipData {
  id: string;
  startTime: number;
  trimStart: number;
  duration: number;
  assetDuration: number;
}

interface UseClipDragOptions {
  clip: ClipData;
  pixelsPerMs: number;
  disabled?: boolean;
  isTrimmingLeft: boolean;
  isTrimmingRight: boolean;
  onDragStart: () => void;
  onDragEnd: (clipId: string, newStartTime: number) => void;
}

interface UseClipDragResult {
  isDraggingClip: boolean;
  dragOffset: number;
  handleMouseDownOnClip: (e: React.MouseEvent) => void;
}

/**
 * Hook for clip drag functionality
 */
export function useClipDrag({
  clip,
  pixelsPerMs,
  disabled = false,
  isTrimmingLeft,
  isTrimmingRight,
  onDragStart,
  onDragEnd,
}: UseClipDragOptions): UseClipDragResult {
  const [isDraggingClip, setIsDraggingClip] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const originalStartTime = useRef(0);

  const handleMouseDownOnClip = useCallback((e: React.MouseEvent) => {
    if (disabled || isTrimmingLeft || isTrimmingRight) return;

    e.stopPropagation();
    setIsDraggingClip(true);
    setDragStartX(e.clientX);
    setDragOffset(0);
    originalStartTime.current = clip.startTime;
    onDragStart();
  }, [disabled, isTrimmingLeft, isTrimmingRight, clip.startTime, onDragStart]);

  useEffect(() => {
    if (!isDraggingClip) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX;
      setDragOffset(deltaX);
    };

    const handleMouseUp = () => {
      setIsDraggingClip(false);

      const deltaMs = dragOffset / pixelsPerMs;
      const newStartTime = Math.max(0, originalStartTime.current + deltaMs);

      setDragOffset(0);

      if (Math.abs(newStartTime - clip.startTime) > 10) {
        onDragEnd(clip.id, newStartTime);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingClip, dragStartX, dragOffset, pixelsPerMs, clip.id, clip.startTime, onDragEnd]);

  return { isDraggingClip, dragOffset, handleMouseDownOnClip };
}

interface UseClipTrimOptions {
  clip: ClipData;
  pixelsPerMs: number;
  disabled?: boolean;
  onTrim: (clipId: string, trimStart: number, duration: number) => void;
  onTrimming?: (clipId: string, newDuration: number) => void;
}

interface UseClipTrimResult {
  isTrimmingLeft: boolean;
  isTrimmingRight: boolean;
  tempTrimStart: number;
  tempDuration: number;
  handleMouseDownLeft: (e: React.MouseEvent) => void;
  handleMouseDownRight: (e: React.MouseEvent) => void;
}

/**
 * Hook for clip trim functionality (left and right edges)
 */
export function useClipTrim({
  clip,
  pixelsPerMs,
  disabled = false,
  onTrim,
  onTrimming,
}: UseClipTrimOptions): UseClipTrimResult {
  const [isTrimmingLeft, setIsTrimmingLeft] = useState(false);
  const [isTrimmingRight, setIsTrimmingRight] = useState(false);
  const [trimStartX, setTrimStartX] = useState(0);
  const [tempTrimStart, setTempTrimStart] = useState(clip.trimStart);
  const [tempDuration, setTempDuration] = useState(clip.duration);

  // Sync temp values when clip changes
  useEffect(() => {
    if (!isTrimmingLeft && !isTrimmingRight) {
      setTempTrimStart(clip.trimStart);
      setTempDuration(clip.duration);
    }
  }, [clip.trimStart, clip.duration, isTrimmingLeft, isTrimmingRight]);

  // Left edge trim (adjust in point)
  const handleMouseDownLeft = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    setIsTrimmingLeft(true);
    setTrimStartX(e.clientX);
    setTempTrimStart(clip.trimStart);
    setTempDuration(clip.duration);
  }, [disabled, clip.trimStart, clip.duration]);

  useEffect(() => {
    if (!isTrimmingLeft) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - trimStartX;
      const deltaMs = deltaX / pixelsPerMs;

      const newTrimStart = Math.max(0, clip.trimStart + deltaMs);
      const newDuration = Math.max(500, clip.duration - deltaMs);

      const validation = validateTrimValues(newTrimStart, newDuration, clip.assetDuration);

      if (validation.valid) {
        setTempTrimStart(newTrimStart);
        setTempDuration(newDuration);
        onTrimming?.(clip.id, newDuration);
      }
    };

    const handleMouseUp = () => {
      setIsTrimmingLeft(false);

      if (
        Math.abs(tempTrimStart - clip.trimStart) > 10 ||
        Math.abs(tempDuration - clip.duration) > 10
      ) {
        onTrim(clip.id, tempTrimStart, tempDuration);
      } else {
        onTrimming?.(clip.id, clip.duration);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isTrimmingLeft, trimStartX, pixelsPerMs, clip, tempTrimStart, tempDuration, onTrim, onTrimming]);

  // Right edge trim (adjust out point)
  const handleMouseDownRight = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    setIsTrimmingRight(true);
    setTrimStartX(e.clientX);
    setTempDuration(clip.duration);
  }, [disabled, clip.duration]);

  useEffect(() => {
    if (!isTrimmingRight) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - trimStartX;
      const deltaMs = deltaX / pixelsPerMs;

      const newDuration = Math.max(500, clip.duration + deltaMs);

      const validation = validateTrimValues(clip.trimStart, newDuration, clip.assetDuration);

      if (validation.valid) {
        setTempDuration(newDuration);
        onTrimming?.(clip.id, newDuration);
      }
    };

    const handleMouseUp = () => {
      setIsTrimmingRight(false);

      if (Math.abs(tempDuration - clip.duration) > 10) {
        onTrim(clip.id, clip.trimStart, tempDuration);
      } else {
        onTrimming?.(clip.id, clip.duration);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isTrimmingRight, trimStartX, pixelsPerMs, clip, tempDuration, onTrim, onTrimming]);

  return {
    isTrimmingLeft,
    isTrimmingRight,
    tempTrimStart,
    tempDuration,
    handleMouseDownLeft,
    handleMouseDownRight,
  };
}

interface UseClipInteractionOptions {
  clip: ClipData;
  pixelsPerMs: number;
  disabled?: boolean;
  onDragStart: () => void;
  onDragEnd: (clipId: string, newStartTime: number) => void;
  onTrim: (clipId: string, trimStart: number, duration: number) => void;
  onTrimming?: (clipId: string, newDuration: number) => void;
}

interface UseClipInteractionResult {
  isDraggingClip: boolean;
  dragOffset: number;
  isTrimmingLeft: boolean;
  isTrimmingRight: boolean;
  tempTrimStart: number;
  tempDuration: number;
  handleMouseDownOnClip: (e: React.MouseEvent) => void;
  handleMouseDownLeft: (e: React.MouseEvent) => void;
  handleMouseDownRight: (e: React.MouseEvent) => void;
}

/**
 * Combined hook for all clip interaction (drag + trim)
 */
export function useClipInteraction({
  clip,
  pixelsPerMs,
  disabled = false,
  onDragStart,
  onDragEnd,
  onTrim,
  onTrimming,
}: UseClipInteractionOptions): UseClipInteractionResult {
  const trim = useClipTrim({
    clip,
    pixelsPerMs,
    disabled,
    onTrim,
    onTrimming,
  });

  const drag = useClipDrag({
    clip,
    pixelsPerMs,
    disabled,
    isTrimmingLeft: trim.isTrimmingLeft,
    isTrimmingRight: trim.isTrimmingRight,
    onDragStart,
    onDragEnd,
  });

  return {
    ...drag,
    ...trim,
  };
}
