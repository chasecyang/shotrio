import { useEffect, useMemo, useRef } from "react";
import type { TimelineDetail } from "@/types/timeline";
import { updateTimeline } from "@/lib/actions/timeline";

/**
 * 防抖自动保存 Hook
 * 自动保存时间轴的修改
 */
export function useTimelineAutosave(timeline: TimelineDetail | null) {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevTimelineRef = useRef<string | null>(null);

  useEffect(() => {
    if (!timeline) return;

    // 序列化timeline用于比较
    const currentTimeline = JSON.stringify({
      title: timeline.title,
      description: timeline.description,
      duration: timeline.duration,
      fps: timeline.fps,
      resolution: timeline.resolution,
      clips: timeline.clips.map(clip => ({
        id: clip.id,
        startTime: clip.startTime,
        duration: clip.duration,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
        order: clip.order,
      })),
    });

    // 检查是否有变化
    if (currentTimeline === prevTimelineRef.current) {
      return;
    }

    prevTimelineRef.current = currentTimeline;

    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 设置新的保存定时器（2秒后保存）
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateTimeline(timeline.id, {
          title: timeline.title,
          description: timeline.description ?? undefined,
          duration: timeline.duration,
          fps: timeline.fps,
          resolution: timeline.resolution,
        });
        console.log("时间轴已自动保存");
      } catch (error) {
        console.error("自动保存失败:", error);
      }
    }, 2000);

    // 清理函数
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [timeline]);
}


