"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { AlertCircle, CheckCircle2, Loader2, Film, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskProgressBar } from "@/components/tasks/task-progress-bar";
import { getUserJobs } from "@/lib/actions/job/user-operations";
import { useTaskSubscription } from "@/hooks/use-task-subscription";
import { cn } from "@/lib/utils";
import type { Job, StoryboardMatchingResult } from "@/types/job";

interface StoryboardExtractionBannerProps {
  episodeId: string;
  onOpenPreview: (jobId: string) => void;
  compact?: boolean;
}

export function StoryboardExtractionBanner({
  episodeId,
  onOpenPreview,
  compact = false,
}: StoryboardExtractionBannerProps) {
  const { jobs: activeJobs } = useTaskSubscription();
  const [completedJob, setCompletedJob] = useState<Job | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  // 查找当前剧集的分镜提取任务（父任务或匹配任务）
  const extractionJob = useMemo(() => {
    // 优先使用活动任务
    const activeJob = activeJobs.find(
      (job) =>
        (job.type === "storyboard_generation" ||
          job.type === "storyboard_basic_extraction" ||
          job.type === "storyboard_matching") &&
        job.inputData &&
        JSON.parse(job.inputData).episodeId === episodeId &&
        (job.status === "pending" || job.status === "processing")
    );

    if (activeJob) return activeJob;

    // 使用已完成的任务（如果还未被处理且未被导入）
    if (completedJob && !isDismissed && !completedJob.isImported) {
      return completedJob;
    }

    return null;
  }, [activeJobs, completedJob, episodeId, isDismissed]);

  // 查找匹配任务结果
  const matchingResult = useMemo(() => {
    if (!extractionJob || extractionJob.type !== "storyboard_generation") return null;

    try {
      const parentResult = JSON.parse(extractionJob.resultData || "{}");
      const matchingJobId = parentResult.matchingJobId;

      if (matchingJobId) {
        const matchingJob = activeJobs.find((j) => j.id === matchingJobId);
        if (matchingJob?.status === "completed" && matchingJob.resultData) {
          return JSON.parse(matchingJob.resultData) as StoryboardMatchingResult;
        }
      }
    } catch (error) {
      console.error("解析匹配结果失败:", error);
    }

    return null;
  }, [extractionJob, activeJobs]);

  // 加载已完成但未处理的任务 - 使用 ref 避免频繁触发
  const hasLoadedCompletedJob = useRef(false);
  const lastEpisodeIdCheck = useRef<string>("");

  useEffect(() => {
    // 如果已被关闭或已有完成的任务，不再检查
    if (isDismissed || completedJob) {
      return;
    }

    // 如果剧集ID改变了，重置加载状态
    if (lastEpisodeIdCheck.current !== episodeId) {
      hasLoadedCompletedJob.current = false;
      lastEpisodeIdCheck.current = episodeId;
    }

    // 如果已经加载过，不再重复加载
    if (hasLoadedCompletedJob.current) {
      return;
    }

    // 检查是否有活动任务
    const hasActiveJob = activeJobs.some(
      (job) =>
        (job.type === "storyboard_generation" ||
          job.type === "storyboard_basic_extraction" ||
          job.type === "storyboard_matching") &&
        job.inputData &&
        JSON.parse(job.inputData).episodeId === episodeId &&
        (job.status === "pending" || job.status === "processing")
    );

    // 只有在没有活动任务时才加载已完成的任务
    if (hasActiveJob) {
      return;
    }

    const loadCompletedJob = async () => {
      try {
        const result = await getUserJobs({
          status: "completed",
          limit: 10,
        });

        if (result.success && result.jobs) {
          // 查找最近的已完成分镜提取任务（且未导入）
          const job = (result.jobs as Job[]).find(
            (job) =>
              job.type === "storyboard_generation" &&
              job.inputData &&
              JSON.parse(job.inputData).episodeId === episodeId &&
              job.status === "completed" &&
              !job.isImported
          );

          if (job) {
            setCompletedJob(job);
            hasLoadedCompletedJob.current = true;
          }
        }
      } catch (error) {
        console.error("加载已完成任务失败:", error);
      }
    };

    loadCompletedJob();
  }, [activeJobs, episodeId, completedJob, isDismissed]);

  if (!extractionJob) return null;

  const isProcessing =
    extractionJob.status === "pending" || extractionJob.status === "processing";
  const isCompleted = extractionJob.status === "completed" && matchingResult;
  const isFailed = extractionJob.status === "failed";

  const shotCount = matchingResult?.shotCount || 0;
  const matchedCharacterCount = matchingResult?.matchedCharacterCount || 0;
  const matchedSceneCount = matchingResult?.matchedSceneCount || 0;

  const handleDismiss = () => {
    setIsDismissed(true);
    setCompletedJob(null);
  };

  const handleOpenPreview = () => {
    if (extractionJob.id) {
      onOpenPreview(extractionJob.id);
    }
  };

  return (
    <div
      className={cn(
        "relative rounded-lg border transition-all duration-300",
        compact ? "mb-0 p-3" : "mb-6 p-4",
        isProcessing && "border-blue-500/50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20",
        isCompleted && "border-green-500/50 bg-green-50/50 dark:bg-green-950/20",
        isFailed && "border-red-500/50 bg-red-50/50 dark:bg-red-950/20"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Icon + Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Icon */}
          {isProcessing && (
            <div className={cn(
              "flex-shrink-0 rounded-full bg-blue-500/10 flex items-center justify-center",
              compact ? "w-8 h-8" : "w-10 h-10"
            )}>
              <Loader2 className={cn(
                "text-blue-600 dark:text-blue-400 animate-spin",
                compact ? "w-4 h-4" : "w-5 h-5"
              )} />
            </div>
          )}
          {isCompleted && (
            <div className={cn(
              "flex-shrink-0 rounded-full bg-green-500/10 flex items-center justify-center",
              compact ? "w-8 h-8" : "w-10 h-10"
            )}>
              <CheckCircle2 className={cn(
                "text-green-600 dark:text-green-400",
                compact ? "w-4 h-4" : "w-5 h-5"
              )} />
            </div>
          )}
          {isFailed && (
            <div className={cn(
              "flex-shrink-0 rounded-full bg-red-500/10 flex items-center justify-center",
              compact ? "w-8 h-8" : "w-10 h-10"
            )}>
              <AlertCircle className={cn(
                "text-red-600 dark:text-red-400",
                compact ? "w-4 h-4" : "w-5 h-5"
              )} />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {isProcessing && (
              <div className={cn("space-y-2", compact && "space-y-1")}>
                <div className="flex items-center gap-2">
                  <Sparkles className={cn(
                    "text-blue-600 dark:text-blue-400 flex-shrink-0",
                    compact ? "w-3 h-3" : "w-4 h-4"
                  )} />
                  <h4 className={cn(
                    "font-semibold text-blue-900 dark:text-blue-100",
                    compact ? "text-xs" : "text-sm"
                  )}>
                    {compact ? "拆分中..." : "正在自动拆分分镜"}
                  </h4>
                </div>
                {!compact && (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {extractionJob.progressMessage || "AI 正在分析剧本内容，生成分镜脚本..."}
                    </p>
                    <div className="max-w-md">
                      <TaskProgressBar
                        progress={extractionJob.progress || 0}
                        status={extractionJob.status || "pending"}
                        showPercentage
                      />
                    </div>
                  </>
                )}
                {compact && (
                  <div className="max-w-full">
                    <TaskProgressBar
                      progress={extractionJob.progress || 0}
                      status={extractionJob.status || "pending"}
                      showPercentage={false}
                    />
                  </div>
                )}
              </div>
            )}

            {isCompleted && matchingResult && (
              <div className={cn("space-y-2", compact && "space-y-1")}>
                <div className="flex items-center gap-2 flex-wrap">
                  <Film className={cn(
                    "text-green-600 dark:text-green-400 flex-shrink-0",
                    compact ? "w-3 h-3" : "w-4 h-4"
                  )} />
                  <h4 className={cn(
                    "font-semibold text-green-900 dark:text-green-100",
                    compact ? "text-xs" : "text-sm"
                  )}>
                    {compact ? "拆分完成" : "分镜拆分完成"}
                  </h4>
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                    {shotCount} 个分镜
                  </Badge>
                  {matchedCharacterCount > 0 && (
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                      {matchedCharacterCount} 个角色
                    </Badge>
                  )}
                  {matchedSceneCount > 0 && (
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                      {matchedSceneCount} 个场景
                    </Badge>
                  )}
                </div>
                {!compact && (
                  <p className="text-xs text-muted-foreground">
                    AI 已成功生成分镜脚本，请查看并选择要导入的分镜
                  </p>
                )}
              </div>
            )}

            {isFailed && (
              <div className={cn("space-y-2", compact && "space-y-1")}>
                <div className="flex items-center gap-2">
                  <AlertCircle className={cn(
                    "text-red-600 dark:text-red-400 flex-shrink-0",
                    compact ? "w-3 h-3" : "w-4 h-4"
                  )} />
                  <h4 className={cn(
                    "font-semibold text-red-900 dark:text-red-100",
                    compact ? "text-xs" : "text-sm"
                  )}>
                    拆分失败
                  </h4>
                </div>
                {!compact && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {extractionJob.errorMessage || "拆分过程中发生错误，请重试"}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Action Button */}
        {isCompleted && matchingResult && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={handleOpenPreview}
              size={compact ? "sm" : "default"}
              className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
            >
              <Sparkles className={cn("mr-2", compact ? "w-3 h-3" : "w-4 h-4")} />
              {compact ? "查看" : "查看并导入"}
            </Button>
          </div>
        )}

        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-background/80 flex-shrink-0"
          onClick={handleDismiss}
        >
          <X className="w-3.5 h-3.5" />
          <span className="sr-only">关闭</span>
        </Button>
      </div>
    </div>
  );
}

