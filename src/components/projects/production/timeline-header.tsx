"use client";

import { ProjectDetail, ShotDetail } from "@/types/project";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Download, Film, Loader2 } from "lucide-react";
import { useState } from "react";
import { createJob } from "@/lib/actions/job";
import { toast } from "sonner";

interface TimelineHeaderProps {
  project: ProjectDetail;
  selectedEpisodeId: string | null;
  onEpisodeChange: (episodeId: string) => void;
  selectedShotIds: string[];
  shots: ShotDetail[];
  userId: string;
  onShotsUpdate: () => void;
}

export function TimelineHeader({
  project,
  selectedEpisodeId,
  onEpisodeChange,
  selectedShotIds,
  shots,
  userId,
  onShotsUpdate,
}: TimelineHeaderProps) {
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const selectedShots = shots.filter((shot) => selectedShotIds.includes(shot.id));
  const shotsWithImages = selectedShots.filter((shot) => shot.imageUrl);
  const shotsWithoutVideos = shotsWithImages.filter((shot) => !shot.videoUrl);

  const handleGenerateVideos = async () => {
    if (shotsWithoutVideos.length === 0) {
      toast.error("所选分镜都已生成视频");
      return;
    }

    setGenerating(true);
    try {
      const result = await createJob({
        userId,
        projectId: project.id,
        type: "batch_video_generation",
        inputData: {
          shotIds: shotsWithoutVideos.map((s) => s.id),
          concurrency: 3,
        },
      });

      if (result.success) {
        toast.success(`已创建批量生成任务，将生成 ${shotsWithoutVideos.length} 个视频`);
      } else {
        toast.error(result.error || "创建任务失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("创建任务失败");
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!selectedEpisodeId) {
      toast.error("请先选择剧集");
      return;
    }

    const episodeShots = shots.filter((shot) => shot.videoUrl);
    if (episodeShots.length === 0) {
      toast.error("该剧集没有已生成的视频");
      return;
    }

    setExporting(true);
    try {
      const result = await createJob({
        userId,
        projectId: project.id,
        type: "final_video_export",
        inputData: {
          episodeId: selectedEpisodeId,
          includeAudio: true,
          includeSubtitles: true,
          exportQuality: "high",
        },
      });

      if (result.success) {
        toast.success("已创建导出任务，请稍候查看任务中心");
      } else {
        toast.error(result.error || "创建任务失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("创建任务失败");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="h-14 border-b border-border bg-card px-4 flex items-center justify-between gap-4">
      {/* 左侧：剧集选择 */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground font-['JetBrains_Mono']">剧集</span>
        <Select value={selectedEpisodeId || undefined} onValueChange={onEpisodeChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="选择剧集" />
          </SelectTrigger>
          <SelectContent>
            {project.episodes.map((episode) => (
              <SelectItem
                key={episode.id}
                value={episode.id}
              >
                第 {episode.order} 集 - {episode.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedShotIds.length > 0 && (
          <span className="text-sm text-muted-foreground font-['JetBrains_Mono']">
            已选 {selectedShotIds.length} 个分镜
          </span>
        )}
      </div>

      {/* 右侧：操作按钮 */}
      <div className="flex items-center gap-2">
        {selectedShotIds.length > 0 && shotsWithoutVideos.length > 0 && (
          <Button
            onClick={handleGenerateVideos}
            disabled={generating}
            size="sm"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Film className="w-4 h-4 mr-2" />
            )}
            生成视频 ({shotsWithoutVideos.length})
          </Button>
        )}

        <Button
          onClick={handleExport}
          disabled={exporting || shots.filter((s) => s.videoUrl).length === 0}
          size="sm"
          variant="outline"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          导出成片
        </Button>
      </div>
    </div>
  );
}
