"use client";

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
} from "lucide-react";
import { useEditor } from "../editor-context";
import { formatDurationMMSS } from "@/lib/utils/shot-utils";
import { cn } from "@/lib/utils";

interface TimelineToolbarProps {
  episodeTitle?: string;
  onAddShot?: () => void;
  onDeleteShots?: () => void;
  onGenerateImages?: () => void;
  onGenerateVideos?: () => void;
}

export function TimelineToolbar({ 
  episodeTitle, 
  onAddShot, 
  onDeleteShots,
  onGenerateImages,
  onGenerateVideos,
}: TimelineToolbarProps) {
  const { state, setTimelineZoom, setPlayhead, totalDuration, selectEpisode } = useEditor();
  const { timeline, selectedShotIds, shots, project, selectedEpisodeId } = state;

  const hasSelectedShots = selectedShotIds.length > 0;

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
    <div className="h-10 border-b border-border flex items-center px-4 gap-4 shrink-0 bg-muted/30">
      {/* 左侧：剧集选择器 */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-muted-foreground">剧集</span>
        <Select
          value={selectedEpisodeId || ""}
          onValueChange={(value) => selectEpisode(value || null)}
        >
          <SelectTrigger className="h-8 w-[180px] text-xs">
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

      <Separator orientation="vertical" className="h-5 bg-border" />

      {/* 分镜信息 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {shots.length} 个分镜
        </span>
        {selectedShotIds.length > 0 && (
          <Badge className="bg-primary/80 text-primary-foreground text-xs">
            已选 {selectedShotIds.length}
          </Badge>
        )}
      </div>

      <Separator orientation="vertical" className="h-5 bg-border" />

      {/* 分镜操作按钮组 */}
      <div className="flex items-center gap-2">
        {/* 添加分镜 */}
        <Button
          variant="outline"
          size="sm"
          onClick={onAddShot}
          className="h-7 text-xs"
          disabled={!selectedEpisodeId}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          添加
        </Button>

        {/* 删除选中 */}
        <Button
          variant="outline"
          size="sm"
          onClick={onDeleteShots}
          className={cn(
            "h-7 text-xs",
            hasSelectedShots && "text-destructive hover:text-destructive hover:bg-destructive/10"
          )}
          disabled={!hasSelectedShots}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          删除{hasSelectedShots ? ` (${selectedShotIds.length})` : ""}
        </Button>

        <Separator orientation="vertical" className="h-5 bg-border" />

        {/* AI 生成按钮组 */}
        <Button
          variant="outline"
          size="sm"
          onClick={onGenerateImages}
          className="h-7 text-xs bg-gradient-to-r from-primary/5 to-purple-500/5 border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-purple-500/10"
          disabled={!hasSelectedShots}
        >
          <ImageIcon className="h-3.5 w-3.5 mr-1" />
          <Sparkles className="h-3 w-3 mr-1" />
          生成图片
          {hasSelectedShots && (
            <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1">
              {selectedShotIds.length}
            </Badge>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onGenerateVideos}
          className="h-7 text-xs bg-gradient-to-r from-primary/5 to-purple-500/5 border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-purple-500/10"
          disabled={!hasSelectedShots}
        >
          <Video className="h-3.5 w-3.5 mr-1" />
          <Sparkles className="h-3 w-3 mr-1" />
          生成视频
        </Button>
      </div>

      <div className="flex-1" />

      {/* 中间：播放头位置 */}
      <div className="flex items-center gap-2">
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

      <Separator orientation="vertical" className="h-5 bg-border" />

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

