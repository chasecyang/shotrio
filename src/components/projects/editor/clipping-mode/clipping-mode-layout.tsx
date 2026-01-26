"use client";

import { useEffect, useState, useCallback } from "react";
import { useEditor } from "../editor-context";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { RemotionPreview } from "./remotion-preview";
import { TimelinePanel } from "./timeline-panel";
import { getCut } from "@/lib/actions/cut";
import { toast } from "sonner";
import { useTimelineAutosave } from "@/hooks/use-timeline-autosave";
import { useRemotionPlayback } from "@/hooks/use-remotion-playback";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { DEFAULT_TRACK_STATES, TrackStates, getCutTracks, generateTrackStates } from "@/types/cut";
import { AssetPreviewOverlay } from "./asset-preview-overlay";
import { AssetWithFullData } from "@/types/asset";
import { ArrowLeft } from "lucide-react";

export function ClippingModeLayout() {
  const { state, setTimeline, setActiveCut } = useEditor();
  const { project, timeline, activeCutId } = state;
  const t = useTranslations("editor");
  const tToast = useTranslations("toasts");

  // 轨道状态（音量、静音）- 根据 timeline 的轨道配置动态生成
  const [trackStates, setTrackStates] = useState<TrackStates>(DEFAULT_TRACK_STATES);

  // 单素材预览状态
  const [previewAsset, setPreviewAsset] = useState<AssetWithFullData | null>(null);

  // 当 timeline 加载后，根据其轨道配置更新 trackStates
  useEffect(() => {
    if (timeline) {
      const tracks = getCutTracks(timeline.metadata);
      setTrackStates(generateTrackStates(tracks));
    }
  }, [timeline?.id, timeline?.metadata]);

  // 切换轨道静音
  const toggleTrackMute = useCallback((trackIndex: number) => {
    setTrackStates((prev) => ({
      ...prev,
      [trackIndex]: {
        ...prev[trackIndex],
        isMuted: !prev[trackIndex]?.isMuted,
      },
    }));
  }, []);

  // 自动保存
  useTimelineAutosave(timeline);

  // 集中管理播放控制（使用 Remotion）
  const playback = useRemotionPlayback({ timeline, trackStates });

  // 加载 Cut 数据
  useEffect(() => {
    if (!project || !activeCutId) return;

    const loadCutData = async () => {
      const cutData = await getCut(activeCutId);
      if (cutData) {
        setTimeline(cutData);
      } else {
        toast.error(tToast("error.loadTimelineFailed"));
        // 如果加载失败，返回素材库
        setActiveCut(null);
      }
    };

    loadCutData();
  }, [project, activeCutId, setTimeline, setActiveCut, tToast]);

  // 返回素材库
  const handleBack = () => {
    setActiveCut(null);
  };

  if (!project) return null;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶部信息栏 */}
      <div className="flex items-center px-4 py-2 border-b shrink-0 gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs">{t("backToGallery")}</span>
        </Button>
        {timeline && (
          <>
            <span className="text-sm font-medium truncate">{timeline.title}</span>
            <span className="text-xs text-muted-foreground">
              {t("clips", { count: timeline.clips.length })}
            </span>
          </>
        )}
      </div>

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
            <div className="h-full w-full bg-zinc-950 relative">
              <RemotionPreview playback={playback} timeline={timeline} />
              {previewAsset && (
                <AssetPreviewOverlay
                  asset={previewAsset}
                  onClose={() => setPreviewAsset(null)}
                />
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* 下部：时间轴 */}
          <ResizablePanel defaultSize={40} minSize={30} className="overflow-hidden">
            <TimelinePanel
              playback={playback}
              trackStates={trackStates}
              onToggleTrackMute={toggleTrackMute}
              onPreviewAsset={setPreviewAsset}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}

