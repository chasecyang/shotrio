"use client";

import { useState, useEffect } from "react";
import { Episode, Character, CharacterImage, ShotDetail, Scene } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Plus, Clapperboard, Loader2, Sparkles } from "lucide-react";
import { getEpisodeShots, reorderShots, createShot } from "@/lib/actions/project";
import { createJob, getJobStatus } from "@/lib/actions/job";
import { ShotCard } from "./shot-card";
import { ShotExtractionDialog } from "./shot-extraction-dialog";
import { useTranslations } from "next-intl";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { toast } from "sonner";

interface ShotGridProps {
  episode: Episode;
  characters: (Character & { images: CharacterImage[] })[];
  projectScenes?: Scene[];
  projectId?: string;
  userId?: string;
}

export function ShotGrid({ episode, characters, projectScenes = [], projectId, userId }: ShotGridProps) {
  const [shots, setShots] = useState<ShotDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionJobId, setExtractionJobId] = useState<string | null>(null);
  const [showExtractionDialog, setShowExtractionDialog] = useState(false);
  const t = useTranslations("projects.storyboard");
  const tCommon = useTranslations("common");

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 8,
        },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 加载分镜列表
  const loadShots = async () => {
    // 如果正在创建中，不显示全局loading，避免闪烁
    if (!isCreating) {
        setLoading(true);
    }
    const data = await getEpisodeShots(episode.id);
    setShots(data);
    setLoading(false);
  };

  useEffect(() => {
    loadShots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode.id]);

  const handleAddShot = async () => {
    setIsCreating(true);
    try {
        const result = await createShot({
            episodeId: episode.id,
            order: shots.length + 1,
            shotSize: "medium_shot", // 默认中景
            duration: 3000,
        });

        if (result.success) {
            toast.success("分镜创建成功");
            await loadShots();
        } else {
            toast.error(result.error || "创建失败");
        }
    } catch (error) {
        console.error(error);
        toast.error("创建失败，请重试");
    } finally {
        setIsCreating(false);
    }
  };

  // AI提取分镜
  const handleExtractShots = async () => {
    if (!userId || !projectId) {
      toast.error("无法获取用户信息");
      return;
    }

    if (!episode.scriptContent || !episode.scriptContent.trim()) {
      toast.error("该剧集没有剧本内容，无法提取分镜");
      return;
    }

    setIsExtracting(true);

    try {
      const result = await createJob({
        userId: userId,
        projectId: projectId,
        type: "storyboard_generation",
        inputData: {
          episodeId: episode.id,
        },
      });

      if (result.success && result.jobId) {
        setExtractionJobId(result.jobId);
        toast.success("AI分镜提取任务已创建，正在处理...");
        
        // 开始轮询任务状态
        pollJobStatus(result.jobId);
      } else {
        toast.error(result.error || "创建任务失败");
        setIsExtracting(false);
      }
    } catch (error) {
      console.error(error);
      toast.error("创建任务失败，请重试");
      setIsExtracting(false);
    }
  };

  // 轮询任务状态 - 修改为检查匹配任务完成
  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 120; // 最多轮询120次（10分钟）- 因为有两步任务
    let attempts = 0;
    let matchingJobId: string | null = null;

    const checkStatus = async () => {
      try {
        const result = await getJobStatus(jobId);
        
        if (!result.success || !result.job) {
          toast.error("获取任务状态失败");
          setIsExtracting(false);
          return;
        }

        const job = result.job;

        // 如果是父任务完成，获取匹配任务ID
        if (job.type === "storyboard_generation" && job.status === "completed" && job.resultData) {
          try {
            const resultData = JSON.parse(job.resultData);
            
            // 查找匹配任务ID
            if (resultData.matchingJobId) {
              matchingJobId = resultData.matchingJobId;
            } else if (resultData.basicExtractionJobId) {
              // 如果只有基础提取任务ID，尝试查找其创建的匹配任务
              const basicResult = await getJobStatus(resultData.basicExtractionJobId);
              if (basicResult.success && basicResult.job?.status === "completed") {
                // 等待匹配任务被创建
                attempts++;
                if (attempts < maxAttempts) {
                  setTimeout(checkStatus, 5000);
                  return;
                }
              }
            }
          } catch (error) {
            console.error("解析任务结果失败:", error);
          }
        }

        // 如果找到了匹配任务ID，检查匹配任务的状态
        if (matchingJobId) {
          const matchingResult = await getJobStatus(matchingJobId);
          
          if (!matchingResult.success || !matchingResult.job) {
            // 匹配任务可能还未创建，继续等待
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(checkStatus, 5000);
            } else {
              toast.error("任务处理超时，请稍后查看任务中心");
              setIsExtracting(false);
            }
            return;
          }

          const matchingJob = matchingResult.job;

          if (matchingJob.status === "completed") {
            toast.success("AI分镜生成完成！");
            setIsExtracting(false);
            setExtractionJobId(matchingJobId); // 更新为匹配任务ID
            setShowExtractionDialog(true);
          } else if (matchingJob.status === "failed") {
            toast.error(matchingJob.errorMessage || "分镜匹配失败");
            setIsExtracting(false);
          } else if (matchingJob.status === "cancelled") {
            toast.error("任务已被取消");
            setIsExtracting(false);
          } else if (matchingJob.status === "processing" || matchingJob.status === "pending") {
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(checkStatus, 5000);
            } else {
              toast.error("任务处理超时，请稍后查看任务中心");
              setIsExtracting(false);
            }
          }
        } else if (job.status === "failed") {
          toast.error(job.errorMessage || "分镜提取失败");
          setIsExtracting(false);
        } else if (job.status === "cancelled") {
          toast.error("任务已被取消");
          setIsExtracting(false);
        } else if (job.status === "processing" || job.status === "pending") {
          // 只有在任务还在处理中时才继续轮询
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(checkStatus, 5000);
          } else {
            toast.error("任务处理超时，请稍后查看任务中心");
            setIsExtracting(false);
          }
        } else {
          // 任务处于其他状态（如completed但没有matchingJobId），停止轮询
          console.warn("任务状态异常:", job.status);
          setIsExtracting(false);
        }
      } catch (error) {
        console.error("检查任务状态失败:", error);
        setIsExtracting(false);
      }
    };

    checkStatus();
  };

  // 处理拖拽结束
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = shots.findIndex((shot) => shot.id === active.id);
    const newIndex = shots.findIndex((shot) => shot.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // 乐观更新UI
    const newShots = arrayMove(shots, oldIndex, newIndex);
    setShots(newShots);

    // 更新order字段
    const updatedOrders = newShots.map((shot, index) => ({
      id: shot.id,
      order: index + 1,
    }));

    // 保存到后端
    try {
      const result = await reorderShots(episode.id, updatedOrders);
      if (!result.success) {
        toast.error(result.error || "重新排序失败");
        // 失败时恢复原顺序
        loadShots();
      } else {
        toast.success("分镜顺序已更新");
      }
    } catch (error) {
      toast.error("重新排序失败，请重试");
      console.error(error);
      // 失败时恢复原顺序
      loadShots();
    }
  };

  if (loading && shots.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  // 空状态
  if (shots.length === 0) {
    return (
      <>
        <div className="flex flex-1 items-center justify-center">
          <div className="border rounded-lg p-8 text-center max-w-md">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Clapperboard className="w-8 h-8 text-primary" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">{t("noShots.title")}</h3>
            <p className="text-muted-foreground mb-6">
              {t("noShots.description", { title: episode.title })}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {episode.scriptContent && episode.scriptContent.trim() && (
                <Button 
                  onClick={handleExtractShots} 
                  disabled={isExtracting}
                  variant="default"
                >
                  {isExtracting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  AI提取分镜
                </Button>
              )}
              <Button onClick={handleAddShot} disabled={isCreating} variant="outline">
                {isCreating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                {t("noShots.action")}
              </Button>
            </div>
          </div>
        </div>

        {/* 分镜提取对话框 */}
        {extractionJobId && (
          <ShotExtractionDialog
            episodeId={episode.id}
            jobId={extractionJobId}
            open={showExtractionDialog}
            onOpenChange={setShowExtractionDialog}
            projectScenes={projectScenes}
            projectCharacters={characters}
            onImportSuccess={loadShots}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      {shots.length > 0 && shots.length < 5 && episode.scriptContent && episode.scriptContent.trim() && (
        <div className="flex justify-end">
          <Button 
            onClick={handleExtractShots} 
            disabled={isExtracting}
            size="sm"
            variant="outline"
          >
            {isExtracting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            AI提取分镜
          </Button>
        </div>
      )}

      {/* 分镜网格 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={shots.map((shot) => shot.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {shots.map((shot) => (
              <ShotCard
                key={shot.id}
                shot={shot}
                characters={characters}
                scenes={projectScenes}
                onUpdate={loadShots}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* 添加分镜按钮 */}
      <div className="flex justify-center pt-4">
        <Button onClick={handleAddShot} variant="outline" size="lg" disabled={isCreating}>
            {isCreating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
                <Plus className="w-4 h-4 mr-2" />
            )}
          {t("addShot")}
        </Button>
      </div>

      {/* 分镜提取对话框 */}
      {extractionJobId && (
        <ShotExtractionDialog
          episodeId={episode.id}
          jobId={extractionJobId}
          open={showExtractionDialog}
          onOpenChange={setShowExtractionDialog}
          projectScenes={projectScenes}
          projectCharacters={characters}
          onImportSuccess={loadShots}
        />
      )}
    </div>
  );
}


