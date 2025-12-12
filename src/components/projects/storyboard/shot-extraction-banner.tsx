"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { AlertCircle, CheckCircle2, Loader2, Film, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskProgressBar } from "@/components/tasks/task-progress-bar";
import { getUserJobs } from "@/lib/actions/job/user-operations";
import { getJobStatus } from "@/lib/actions/job";
import { useTaskSubscription } from "@/hooks/use-task-subscription";
import { cn } from "@/lib/utils";
import type { Job, StoryboardGenerationResult, StoryboardMatchingResult } from "@/types/job";

interface ShotExtractionBannerProps {
  episodeId: string;
  onOpenPreview: (jobId: string) => void;
  recentlyImportedJobId?: string | null;
}

export function ShotExtractionBanner({
  episodeId,
  onOpenPreview,
  recentlyImportedJobId,
}: ShotExtractionBannerProps) {
  const { jobs: activeJobs } = useTaskSubscription();
  const [completedJob, setCompletedJob] = useState<Job | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [matchingJobId, setMatchingJobId] = useState<string | null>(null);
  const [matchingStatus, setMatchingStatus] = useState<"pending" | "processing" | "completed" | "failed" | "cancelled" | null>(null);

  // 查找当前剧集的分镜提取任务
  const extractionJob = useMemo(() => {
    // 辅助函数：检查任务是否属于当前剧集
    const matchesEpisode = (job: Partial<Job>) => {
      if (!job.inputData) return false;
      try {
        const inputData = typeof job.inputData === 'string' 
          ? JSON.parse(job.inputData) 
          : job.inputData;
        return inputData.episodeId === episodeId;
      } catch {
        return false;
      }
    };

    // 优先查找匹配任务（第二步）
    const activeMatchingJob = activeJobs.find(
      (job) =>
        job.type === "storyboard_matching" &&
        (job.status === "pending" || job.status === "processing") &&
        matchesEpisode(job)
    );

    if (activeMatchingJob) return activeMatchingJob;

    // 查找基础提取任务（第一步）
    const activeBasicJob = activeJobs.find(
      (job) =>
        job.type === "storyboard_basic_extraction" &&
        (job.status === "pending" || job.status === "processing") &&
        matchesEpisode(job)
    );

    if (activeBasicJob) return activeBasicJob;

    // 查找父任务（用于获取子任务信息）
    const activeParentJob = activeJobs.find(
      (job) =>
        job.type === "storyboard_generation" &&
        (job.status === "pending" || job.status === "processing") &&
        matchesEpisode(job)
    );

    if (activeParentJob) return activeParentJob;

    // 使用已完成的任务（如果还未被处理）
    if (completedJob && !isDismissed) {
      return completedJob;
    }

    return null;
  }, [activeJobs, completedJob, episodeId, isDismissed]);

  // 加载已完成但未处理的匹配任务 - 使用 ref 避免频繁触发
  const hasLoadedCompletedJob = useRef(false);
  const lastActiveJobCheck = useRef<string>("");
  
  useEffect(() => {
    // 如果已被关闭或已有完成的任务，不再检查
    if (isDismissed || completedJob) {
      return;
    }

    // 辅助函数：检查任务是否属于当前剧集
    const matchesEpisode = (job: Partial<Job>) => {
      if (!job.inputData) return false;
      try {
        const inputData = typeof job.inputData === 'string' 
          ? JSON.parse(job.inputData) 
          : job.inputData;
        return inputData.episodeId === episodeId;
      } catch {
        return false;
      }
    };

    // 检查是否有活动任务
    const hasActiveJob = activeJobs.some(
      (job) =>
        (job.type === "storyboard_matching" || 
         job.type === "storyboard_basic_extraction" ||
         job.type === "storyboard_generation") &&
        (job.status === "pending" || job.status === "processing") &&
        matchesEpisode(job)
    );

    // 创建一个字符串来表示当前状态，避免数组引用变化导致的重复触发
    const currentCheck = `${hasActiveJob}-${hasLoadedCompletedJob.current}`;
    
    // 如果状态没变化，不重复执行
    if (currentCheck === lastActiveJobCheck.current) {
      return;
    }
    
    lastActiveJobCheck.current = currentCheck;

    const loadCompletedJob = async () => {
      try {
        const result = await getUserJobs({
          status: "completed",
          limit: 20,
        });

        if (result.success && result.jobs) {
          // 查找最近的已完成分镜匹配任务
          const job = (result.jobs as Job[]).find(
            (job) =>
              job.type === "storyboard_matching" &&
              job.status === "completed" &&
              matchesEpisode(job)
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

    // 只有在没有活动任务且还未加载过时才加载
    if (!hasActiveJob && !hasLoadedCompletedJob.current) {
      loadCompletedJob();
    }
  }, [activeJobs, episodeId, completedJob, isDismissed]);

  // 获取匹配任务的状态
  useEffect(() => {
    if (!extractionJob) return;

    let isMounted = true;
    let interval: NodeJS.Timeout | null = null;

    const checkMatchingJob = async () => {
      if (!isMounted || !extractionJob) return;

      // 如果是父任务，获取其子任务的状态
      if (extractionJob.type === "storyboard_generation") {
        if (extractionJob.status === "completed" && extractionJob.resultData) {
          try {
            const result: StoryboardGenerationResult = JSON.parse(extractionJob.resultData);
            
            // 查找匹配任务ID
            if (result.matchingJobId) {
              if (isMounted) {
                setMatchingJobId(result.matchingJobId);
                
                // 获取匹配任务的状态
                const matchingJobResult = await getJobStatus(result.matchingJobId);
                if (isMounted && matchingJobResult.success && matchingJobResult.job) {
                  setMatchingStatus(matchingJobResult.job.status);
                  
                  // 如果匹配任务已完成，停止轮询
                  if (matchingJobResult.job.status === "completed" || 
                      matchingJobResult.job.status === "failed" || 
                      matchingJobResult.job.status === "cancelled") {
                    if (interval) {
                      clearInterval(interval);
                      interval = null;
                    }
                  }
                }
              }
            } else if (result.basicExtractionJobId) {
              // 如果只有基础提取任务ID，继续检查
              const basicResult = await getJobStatus(result.basicExtractionJobId);
              if (isMounted && basicResult.success && basicResult.job) {
                if (basicResult.job.status === "completed") {
                  setMatchingStatus("pending");
                } else if (basicResult.job.status === "failed" || basicResult.job.status === "cancelled") {
                  setMatchingStatus(basicResult.job.status);
                  if (interval) {
                    clearInterval(interval);
                    interval = null;
                  }
                } else {
                  setMatchingStatus(basicResult.job.status);
                }
              }
            }
          } catch (error) {
            console.error("解析任务结果失败:", error);
          }
        } else if (extractionJob.status === "processing" || extractionJob.status === "pending") {
          if (isMounted) {
            setMatchingStatus("pending");
          }
        } else if (extractionJob.status === "failed" || extractionJob.status === "cancelled") {
          if (isMounted) {
            setMatchingStatus(extractionJob.status);
          }
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      } else if (extractionJob.type === "storyboard_matching") {
        if (isMounted) {
          setMatchingJobId(extractionJob.id || null);
          setMatchingStatus(extractionJob.status || null);
        }
        
        // 如果已经完成，停止轮询
        if (extractionJob.status === "completed" || 
            extractionJob.status === "failed" || 
            extractionJob.status === "cancelled") {
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      } else if (extractionJob.type === "storyboard_basic_extraction") {
        if (extractionJob.status === "completed") {
          if (isMounted) setMatchingStatus("pending");
        } else if (extractionJob.status === "failed" || extractionJob.status === "cancelled") {
          if (isMounted) setMatchingStatus(extractionJob.status);
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        } else if (extractionJob.status) {
          if (isMounted) setMatchingStatus(extractionJob.status);
        }
      }
    };

    // 检查任务是否需要轮询
    const shouldPoll = 
      extractionJob.status === "pending" || 
      extractionJob.status === "processing";

    // 立即执行一次检查
    checkMatchingJob();

    // 只有当任务处于进行中状态时才定期轮询
    if (shouldPoll) {
      interval = setInterval(checkMatchingJob, 5000);
    }

    return () => {
      isMounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [extractionJob]);

  // 如果当前任务是最近导入的，自动隐藏
  if (extractionJob && recentlyImportedJobId === extractionJob.id) {
    return null;
  }

  // 如果已经是匹配任务，也检查是否是最近导入的
  if (matchingJobId && recentlyImportedJobId === matchingJobId) {
    return null;
  }

  if (!extractionJob) return null;

  const isProcessing =
    extractionJob.status === "pending" || 
    extractionJob.status === "processing" ||
    (matchingStatus === "pending" || matchingStatus === "processing");
  
  const isCompleted = 
    (extractionJob.type === "storyboard_matching" && extractionJob.status === "completed") ||
    (matchingStatus === "completed");
  
  const isFailed = 
    extractionJob.status === "failed" || 
    extractionJob.status === "cancelled" ||
    matchingStatus === "failed" || 
    matchingStatus === "cancelled";

  // 解析提取结果（用于显示分镜数量）
  let shotCount = 0;
  if (isCompleted) {
    try {
      if (extractionJob.type === "storyboard_matching" && extractionJob.resultData) {
        const matchingResult: StoryboardMatchingResult = JSON.parse(extractionJob.resultData);
        shotCount = matchingResult.shotCount || 0;
      }
    } catch (error) {
      console.error("解析提取结果失败:", error);
    }
  }

  // 获取进度信息
  const getProgressInfo = () => {
    if (extractionJob.type === "storyboard_basic_extraction") {
      return {
        message: extractionJob.progressMessage || "AI 正在分析剧本，生成基础分镜...",
        progress: extractionJob.progress || 0,
      };
    } else if (extractionJob.type === "storyboard_matching" || matchingStatus === "processing") {
      return {
        message: extractionJob.progressMessage || "正在智能匹配场景和角色...",
        progress: extractionJob.progress || 50,
      };
    } else {
      return {
        message: extractionJob.progressMessage || "正在准备分镜提取任务...",
        progress: extractionJob.progress || 10,
      };
    }
  };

  const progressInfo = getProgressInfo();

  const handleDismiss = () => {
    setIsDismissed(true);
    setCompletedJob(null);
  };

  const handleOpenPreview = () => {
    // 优先使用匹配任务ID，如果没有则使用当前任务ID
    const jobIdToOpen = matchingJobId || extractionJob.id;
    if (jobIdToOpen) {
      onOpenPreview(jobIdToOpen);
    }
  };

  return (
    <div
      className={cn(
        "relative mb-6 rounded-lg border p-4 transition-all duration-300",
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
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
          )}
          {isCompleted && (
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
          )}
          {isFailed && (
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    正在生成分镜
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  {progressInfo.message}
                </p>
                <div className="max-w-md">
                  <TaskProgressBar
                    progress={progressInfo.progress}
                    status={extractionJob.status || "pending"}
                    showPercentage
                  />
                </div>
              </div>
            )}

            {isCompleted && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Film className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <h4 className="text-sm font-semibold text-green-900 dark:text-green-100">
                    分镜生成完成
                  </h4>
                  {shotCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                        {shotCount} 个分镜
                      </Badge>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  AI 已成功生成分镜并匹配场景角色，请查看并选择要导入的分镜
                </p>
              </div>
            )}

            {isFailed && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <h4 className="text-sm font-semibold text-red-900 dark:text-red-100">
                    {extractionJob.status === "cancelled" || matchingStatus === "cancelled" 
                      ? "分镜生成已取消" 
                      : "分镜生成失败"}
                  </h4>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400">
                  {extractionJob.status === "cancelled" || matchingStatus === "cancelled"
                    ? "任务已被用户取消"
                    : (extractionJob.errorMessage || "生成过程中发生错误，请重试")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Action Button */}
        {isCompleted && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={handleOpenPreview}
              className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              查看并导入
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

