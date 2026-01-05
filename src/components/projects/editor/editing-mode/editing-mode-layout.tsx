"use client";

import { useEffect } from "react";
import { useEditor } from "../editor-context";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { VideoPreview } from "./video-preview";
import { TimelinePanel } from "./timeline-panel";
import { getOrCreateProjectTimeline } from "@/lib/actions/timeline";
import { toast } from "sonner";
import { useTimelineAutosave } from "@/hooks/use-timeline-autosave";
import { useVideoPlayback } from "@/hooks/use-video-playback";
import { Skeleton } from "@/components/ui/skeleton";

export function EditingModeLayout() {
  const { state, setTimeline } = useEditor();
  const { project, timeline } = state;

  // 自动保存
  useTimelineAutosave(timeline);

  // 集中管理视频播放控制
  const videoPlayback = useVideoPlayback({ timeline });

  // 加载或创建时间轴
  useEffect(() => {
    if (!project) return;

    const loadTimeline = async () => {
      const result = await getOrCreateProjectTimeline(project.id);
      if (result.success && result.timeline) {
        setTimeline(result.timeline);
      } else {
        toast.error(result.error || "加载时间轴失败");
      }
    };

    loadTimeline();
  }, [project, setTimeline]);

  if (!project) return null;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶部信息栏 - 简化版 */}
      {timeline && (
        <div className="flex items-center px-4 py-2 border-b shrink-0">
          <span className="text-xs text-muted-foreground">
            {timeline.clips.length} 个片段
          </span>
        </div>
      )}

      {/* 主内容区：根据 timeline 状态条件渲染 */}
      {!timeline ? (
        // 内容区 skeleton
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-black/95 flex items-center justify-center p-8">
            <Skeleton className="w-full max-w-4xl aspect-video" />
          </div>
          <div className="h-64 border-t bg-background p-4">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </div>
      ) : (
        // 实际内容：上下分栏
        <ResizablePanelGroup direction="vertical" className="flex-1 overflow-hidden">
          {/* 上部：预览窗口 */}
          <ResizablePanel defaultSize={60} minSize={30} className="overflow-hidden">
            <div className="h-full w-full bg-zinc-950 flex items-center justify-center">
              <VideoPreview playback={videoPlayback} />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* 下部：时间轴 */}
          <ResizablePanel defaultSize={40} minSize={30} className="overflow-hidden">
            <TimelinePanel playback={videoPlayback} />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}

