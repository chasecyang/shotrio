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
  ImageIcon,
  Video,
  Sparkles,
  Film,
  X,
} from "lucide-react";
import { useEditor } from "../editor-context";
import { formatDurationMMSS } from "@/lib/utils/shot-utils";
import { cn } from "@/lib/utils";
import { startStoryboardGeneration } from "@/lib/actions/storyboard";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface TimelineToolbarProps {
  episodeTitle?: string;
  onAddShot?: () => void;
  onDeleteShots?: () => void;
  onGenerateImages?: () => void;
  onGenerateVideos?: () => void;
}

// 核心控制栏 - 第一行
function CoreControlBar() {
  const { state, setTimelineZoom, setPlayhead, totalDuration, selectEpisode } = useEditor();
  const { timeline, project, selectedEpisodeId } = state;
  const isMobile = useIsMobile();

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

  return (
    <div className="h-10 border-b border-border flex items-center px-3 md:px-4 gap-2 md:gap-4 shrink-0 bg-muted/30">
      {/* 左侧：剧集选择器 */}
      <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
        {!isMobile && <span className="text-xs text-muted-foreground">剧集</span>}
        <Select
          value={selectedEpisodeId || ""}
          onValueChange={(value) => selectEpisode(value || null)}
        >
          <SelectTrigger className={cn("h-8 text-xs", isMobile ? "w-[120px]" : "w-[180px]")}>
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

      {/* 中间：时间播放控制 */}
      <div className="flex items-center gap-1.5 md:gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={handleSkipToStart}
        >
          <SkipBack className="h-3.5 w-3.5" />
        </Button>

        <div className="flex items-center gap-1 md:gap-1.5 px-1.5 md:px-2 py-1 rounded bg-muted">
          {!isMobile && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
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
      <div className="flex items-center gap-1.5 md:gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={handleZoomOut}
          disabled={timeline.zoom <= 0.5}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>

        {!isMobile && (
          <div className="w-20 md:w-24">
            <Slider
              value={[timeline.zoom]}
              min={0.5}
              max={3}
              step={0.25}
              onValueChange={([value]) => setTimelineZoom(value)}
              className="[&_[data-slot=slider-track]]:bg-muted [&_[data-slot=slider-range]]:bg-primary/60 [&_[data-slot=slider-thumb]]:bg-primary [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:h-3 [&_[data-slot=slider-thumb]]:w-3"
            />
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={handleZoomIn}
          disabled={timeline.zoom >= 3}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>

        {!isMobile && (
          <span className="text-xs text-muted-foreground w-10 text-right">
            {Math.round(timeline.zoom * 100)}%
          </span>
        )}
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
  const { shots, project, selectedEpisodeId } = state;
  const isMobile = useIsMobile();

  const selectedEpisode = project?.episodes.find((ep) => ep.id === selectedEpisodeId);
  const hasScriptContent = selectedEpisode?.scriptContent && selectedEpisode.scriptContent.trim();

  const handleStartExtraction = async () => {
    if (!selectedEpisodeId) {
      toast.error("请先选择剧集");
      return;
    }
    if (!hasScriptContent) {
      toast.error("请先编写剧本内容");
      return;
    }

    const result = await startStoryboardGeneration(selectedEpisodeId);
    if (result.success) {
      toast.success("已启动分镜提取任务");
    } else {
      toast.error(result.error || "启动失败");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.15 }}
      className="h-9 border-b border-border/50 flex items-center px-3 md:px-4 gap-2 md:gap-3 shrink-0 bg-muted/10"
    >
      {/* 分镜信息 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {shots.length} 个分镜
        </span>
      </div>

      <Separator orientation="vertical" className="h-4 bg-border/50" />

      {/* AI 自动拆分 */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleStartExtraction}
        className={cn(
          "h-7 text-xs border-blue-200 dark:border-blue-800/50",
          "hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/30 dark:hover:border-blue-700"
        )}
        disabled={!selectedEpisodeId || !hasScriptContent}
      >
        <Film className="h-3.5 w-3.5 mr-1" />
        <Sparkles className="h-3 w-3 mr-1" />
        {!isMobile && "AI "}自动拆分
      </Button>

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
  onGenerateImages,
  onGenerateVideos,
}: {
  onDeleteShots?: () => void;
  onGenerateImages?: () => void;
  onGenerateVideos?: () => void;
}) {
  const { state, clearShotSelection } = useEditor();
  const { selectedShotIds } = state;
  const isMobile = useIsMobile();

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.15 }}
      className="h-9 border-b border-border/50 flex items-center px-3 md:px-4 gap-2 md:gap-3 shrink-0 bg-blue-50/50 dark:bg-blue-950/20"
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
        删除{!isMobile && ` (${selectedShotIds.length})`}
      </Button>

      <Separator orientation="vertical" className="h-4 bg-border/50" />

      {/* AI 生成按钮组 */}
      <Button
        variant="outline"
        size="sm"
        onClick={onGenerateImages}
        className={cn(
          "h-7 text-xs border-purple-200 dark:border-purple-800/50",
          "hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-950/30 dark:hover:border-purple-700"
        )}
      >
        <ImageIcon className="h-3.5 w-3.5 mr-1" />
        <Sparkles className="h-3 w-3 mr-1" />
        生成图片
        {!isMobile && (
          <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1">
            {selectedShotIds.length}
          </Badge>
        )}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onGenerateVideos}
        className={cn(
          "h-7 text-xs border-purple-200 dark:border-purple-800/50",
          "hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-950/30 dark:hover:border-purple-700"
        )}
      >
        <Video className="h-3.5 w-3.5 mr-1" />
        <Sparkles className="h-3 w-3 mr-1" />
        生成视频
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
        {!isMobile && "取消选择"}
      </Button>
    </motion.div>
  );
}

// 主组件
export function TimelineToolbar({
  episodeTitle,
  onAddShot,
  onDeleteShots,
  onGenerateImages,
  onGenerateVideos,
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
            onGenerateImages={onGenerateImages}
            onGenerateVideos={onGenerateVideos}
          />
        ) : (
          <DefaultActionsBar key="default" onAddShot={onAddShot} />
        )}
      </AnimatePresence>
    </div>
  );
}

