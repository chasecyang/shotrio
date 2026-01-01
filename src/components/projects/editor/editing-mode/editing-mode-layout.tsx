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
import { Skeleton } from "@/components/ui/skeleton";
import { Images, Film } from "lucide-react";
import { cn } from "@/lib/utils";

export function EditingModeLayout() {
  const { state, setTimeline, setMode } = useEditor();
  const { project, timeline } = state;

  // 自动保存
  useTimelineAutosave(timeline);

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

  if (!timeline) {
    return (
      <div className="h-full flex flex-col bg-background">
        {/* 顶部工具栏骨架 - 和素材库header样式一致 */}
        <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>

        {/* 主内容区骨架 */}
        <div className="flex-1 flex flex-col">
          {/* 预览窗口骨架 */}
          <div className="flex-1 bg-black/95 flex items-center justify-center p-8">
            <Skeleton className="w-full max-w-4xl aspect-video" />
          </div>

          {/* 时间轴骨架 */}
          <div className="h-64 border-t bg-background p-4">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶部工具栏 - 和素材库header样式一致 */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          {/* 模式切换器 */}
          <div className="inline-flex items-center rounded-lg bg-muted p-1 gap-1">
            <button
              onClick={() => setMode("asset-management")}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                "hover:bg-background/60",
                "text-muted-foreground"
              )}
            >
              <Images className="h-4 w-4" />
              <span>素材</span>
            </button>
            <button
              onClick={() => setMode("editing")}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                "hover:bg-background/60",
                "bg-background text-foreground shadow-sm"
              )}
            >
              <Film className="h-4 w-4" />
              <span>剪辑</span>
            </button>
          </div>
          <span className="text-xs text-muted-foreground">
            {timeline.clips.length} 个片段
          </span>
        </div>
      </div>

      {/* 主内容区：上下分栏 */}
      <ResizablePanelGroup direction="vertical" className="flex-1 overflow-hidden">
        {/* 上部：预览窗口 */}
        <ResizablePanel defaultSize={60} minSize={30} className="overflow-hidden">
          <div className="h-full w-full bg-zinc-950 flex items-center justify-center">
            <VideoPreview />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 下部：时间轴 */}
        <ResizablePanel defaultSize={40} minSize={30} className="overflow-hidden">
          <TimelinePanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

