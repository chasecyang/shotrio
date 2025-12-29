"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ZoomIn,
  ZoomOut,
  SkipBack,
  SkipForward,
  Clock,
  Plus,
  Trash2,
  X,
  Play,
  Download,
} from "lucide-react";
import { useEditor } from "../editor-context";
import { formatDurationMMSS } from "@/lib/utils/shot-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface TimelineToolbarProps {
  onAddShot?: () => void;
  onDeleteShots?: () => void;
  onExportVideos?: () => void;
  isExportingVideos?: boolean;
}

// 核心控制栏 - 第一行
function CoreControlBar() {
  const tToast = useTranslations("toasts");
  const { state, setTimelineZoom, setPlayhead, totalDuration, selectEpisode, startPlayback } = useEditor();
  const { timeline, project, selectedEpisodeId, playbackState, shots } = state;

  const handleZoomIn = () => {
    setTimelineZoom(timeline.zoom + 0.25);
  };

  const handleZoomOut = () => {
    setTimelineZoom(timeline.zoom - 0.25);
  };

  const handleSkipToStart = () => {
    setPlayhead(0);
  };

  const handleSkipToEnd = () => {
    setPlayhead(totalDuration);
  };

  const handlePlayback = () => {
    if (shots.length === 0) {
      toast.error(tToast("error.noShotsToPlay"));
      return;
    }
    startPlayback();
  };

  const canPlayback = shots.length > 0 && !playbackState.isPlaybackMode;

  return (
    <div className="h-10 border-b border-border flex items-center px-4 gap-4 shrink-0 bg-muted/30">
      {/* 左侧：剧集选择器 */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-muted-foreground">剧集</span>
        <Select
          value={selectedEpisodeId || ""}
          onValueChange={(value) => selectEpisode(value || null)}
        >
          <SelectTrigger className="h-8 text-xs w-[180px]">
            <SelectValue placeholder="选择剧集" />
          </SelectTrigger>
          <SelectContent>
            {project?.episodes.map((episode) => (
              <SelectItem key={episode.id} value={episode.id} className="text-xs">
                第 {episode.order} 集 - {episode.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1" />

      {/* 中间：播放和时间控制 */}
      <div className="flex items-center gap-2">
        {/* 播放按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 hover:bg-muted",
            canPlayback 
              ? "text-primary hover:text-primary" 
              : "text-muted-foreground cursor-not-allowed"
          )}
          onClick={handlePlayback}
          disabled={!canPlayback}
          title={canPlayback ? "播放分镜" : "没有可播放的分镜"}
        >
          <Play className="h-3.5 w-3.5" />
        </Button>

        <Separator orientation="vertical" className="h-4 bg-border/50 mx-0.5" />

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={handleSkipToStart}
        >
          <SkipBack className="h-3.5 w-3.5" />
        </Button>

        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-mono text-foreground">
            {formatDurationMMSS(timeline.playhead)}
          </span>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="text-xs font-mono text-muted-foreground">
            {formatDurationMMSS(totalDuration)}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={handleSkipToEnd}
        >
          <SkipForward className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1" />

      {/* 右侧：缩放控制 */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={handleZoomOut}
          disabled={timeline.zoom <= 0.5}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>

        <div className="w-24">
          <Slider
            value={[timeline.zoom]}
            min={0.5}
            max={3}
            step={0.25}
            onValueChange={([value]) => setTimelineZoom(value)}
            className="[&_[data-slot=slider-track]]:bg-muted [&_[data-slot=slider-range]]:bg-primary/60 [&_[data-slot=slider-thumb]]:bg-primary [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:h-3 [&_[data-slot=slider-thumb]]:w-3"
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={handleZoomIn}
          disabled={timeline.zoom >= 3}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>

        <span className="text-xs text-muted-foreground w-10 text-right">
          {Math.round(timeline.zoom * 100)}%
        </span>
      </div>
    </div>
  );
}

// 上下文操作栏 - 第二行（无选中状态）
function DefaultActionsBar({
  onAddShot,
}: {
  onAddShot?: () => void;
}) {
  const { state } = useEditor();
  const { shots, selectedEpisodeId } = state;

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.15 }}
      className="h-9 border-b border-border/50 flex items-center px-4 gap-3 shrink-0 bg-muted/10"
    >
      {/* 分镜信息 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {shots.length} 个分镜
        </span>
      </div>

      <Separator orientation="vertical" className="h-4 bg-border/50" />

      {/* 手动添加 */}
      <Button
        variant="outline"
        size="sm"
        onClick={onAddShot}
        className="h-7 text-xs"
        disabled={!selectedEpisodeId}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        添加分镜
      </Button>
    </motion.div>
  );
}

// 上下文操作栏 - 第二行（选中状态）
function SelectionActionsBar({
  onDeleteShots,
  onExportVideos,
  isExportingVideos,
}: {
  onDeleteShots?: () => void;
  onExportVideos?: () => void;
  isExportingVideos?: boolean;
}) {
  const { state, clearShotSelection } = useEditor();
  const { selectedShotIds } = state;

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.15 }}
      className="h-9 border-b border-border/50 flex items-center px-4 gap-3 shrink-0 bg-blue-50/50 dark:bg-blue-950/20"
    >
      {/* 选中信息 */}
      <div className="flex items-center gap-2">
        <Badge variant="default" className="text-xs h-5">
          已选 {selectedShotIds.length}
        </Badge>
      </div>

      <Separator orientation="vertical" className="h-4 bg-border/50" />

      {/* 删除按钮 */}
      <Button
        variant="outline"
        size="sm"
        onClick={onDeleteShots}
        className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive"
      >
        <Trash2 className="h-3.5 w-3.5 mr-1" />
        删除 ({selectedShotIds.length})
      </Button>

      <Separator orientation="vertical" className="h-4 bg-border/50" />

      {/* 导出视频按钮 */}
      <Button
        variant="outline"
        size="sm"
        onClick={onExportVideos}
        disabled={isExportingVideos}
        className={cn(
          "h-7 text-xs border-green-200 dark:border-green-800/50",
          "hover:bg-green-50 hover:border-green-300 dark:hover:bg-green-950/30 dark:hover:border-green-700"
        )}
      >
        <Download className={cn("h-3.5 w-3.5 mr-1", isExportingVideos && "animate-bounce")} />
        {isExportingVideos ? "导出中..." : "导出视频"}
        {!isExportingVideos && (
          <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1">
            {selectedShotIds.length}
          </Badge>
        )}
      </Button>

      <div className="flex-1" />

      {/* 取消选择 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={clearShotSelection}
        className="h-7 text-xs text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5 mr-1" />
        取消选择
      </Button>
    </motion.div>
  );
}

// 主组件
export function TimelineToolbar({
  onAddShot,
  onDeleteShots,
  onExportVideos,
  isExportingVideos,
}: TimelineToolbarProps) {
  const { state, clearShotSelection } = useEditor();
  const { selectedShotIds } = state;

  const hasSelectedShots = selectedShotIds.length > 0;

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc 取消选择
      if (e.key === "Escape" && hasSelectedShots) {
        clearShotSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasSelectedShots, clearShotSelection]);

  return (
    <div className="shrink-0">
      {/* 第一行：核心控制栏 */}
      <CoreControlBar />

      {/* 第二行：上下文操作栏（根据选中状态动态切换） */}
      <AnimatePresence mode="wait">
        {hasSelectedShots ? (
          <SelectionActionsBar
            key="selection"
            onDeleteShots={onDeleteShots}
            onExportVideos={onExportVideos}
            isExportingVideos={isExportingVideos}
          />
        ) : (
          <DefaultActionsBar key="default" onAddShot={onAddShot} />
        )}
      </AnimatePresence>
    </div>
  );
}

