"use client";

import { useState, useEffect } from "react";
import { ProjectDetail } from "@/types/project";
import { ShotListPanel } from "./shot-list-panel";
import { VideoPreviewPanel } from "./video-preview-panel";
import { TimelineTracks } from "./timeline-tracks";
import { TimelineHeader } from "./timeline-header";
import { getEpisodeShots } from "@/lib/actions/project";
import { ShotDetail } from "@/types/project";
import { useTaskSubscription } from "@/hooks/use-task-subscription";
import { toast } from "sonner";

interface ProductionTimelineProps {
  project: ProjectDetail;
  userId: string;
}

export function ProductionTimeline({ project, userId }: ProductionTimelineProps) {
  const [shots, setShots] = useState<ShotDetail[]>([]);
  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(
    project.episodes[0]?.id || null
  );
  const [zoom, setZoom] = useState<number>(1);
  const [playhead, setPlayhead] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  // 订阅任务更新
  const { jobs: activeJobs } = useTaskSubscription();

  // 加载选中剧集的分镜
  const loadShots = async () => {
    if (!selectedEpisodeId) {
      setShots([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getEpisodeShots(selectedEpisodeId);
      setShots(data);
    } catch (error) {
      console.error("加载分镜失败:", error);
      toast.error("加载分镜失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEpisodeId]);

  // 监听视频生成任务完成，刷新分镜列表
  useEffect(() => {
    const videoJobs = activeJobs.filter(
      (job) =>
        (job.type === "shot_video_generation" || job.type === "batch_video_generation") &&
        job.status === "completed"
    );

    if (videoJobs.length > 0) {
      // 延迟刷新，确保数据库已更新
      setTimeout(() => {
        loadShots();
      }, 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJobs]);

  const selectedShot = shots.find((shot) => selectedShotIds.includes(shot.id));

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* 顶部工具栏 */}
      <TimelineHeader
        project={project}
        selectedEpisodeId={selectedEpisodeId}
        onEpisodeChange={setSelectedEpisodeId}
        selectedShotIds={selectedShotIds}
        shots={shots}
        userId={userId}
        onShotsUpdate={loadShots}
      />

      {/* 主内容区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧分镜列表 */}
        <ShotListPanel
          shots={shots}
          selectedShotIds={selectedShotIds}
          onSelectionChange={setSelectedShotIds}
          onShotsUpdate={loadShots}
          loading={loading}
        />

        {/* 中央预览区 */}
        <VideoPreviewPanel
          shot={selectedShot}
          shots={shots}
          playhead={playhead}
          isPlaying={isPlaying}
          onPlayheadChange={setPlayhead}
          onPlayingChange={setIsPlaying}
        />
      </div>

      {/* 底部时间轴 */}
      <TimelineTracks
        shots={shots}
        selectedShotIds={selectedShotIds}
        onSelectionChange={setSelectedShotIds}
        zoom={zoom}
        onZoomChange={setZoom}
        playhead={playhead}
        onPlayheadChange={setPlayhead}
        isPlaying={isPlaying}
      />
    </div>
  );
}
