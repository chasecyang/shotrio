"use client";

import { useState, useEffect, useCallback } from "react";
import { useTaskSubscription } from "@/hooks/use-task-subscription";
import { startStoryboardGeneration } from "@/lib/actions/storyboard";
import { toast } from "sonner";
import type { Job, StoryboardMatchingResult } from "@/types/job";

interface UseStoryboardExtractionOptions {
  episodeId: string;
  onExtractionComplete?: (result: StoryboardMatchingResult) => void;
}

interface UseStoryboardExtractionReturn {
  isExtracting: boolean;
  extractionJob: Partial<Job> | null;
  extractionResult: StoryboardMatchingResult | null;
  startExtraction: () => Promise<void>;
  clearResult: () => void;
}

export function useStoryboardExtraction({
  episodeId,
  onExtractionComplete,
}: UseStoryboardExtractionOptions): UseStoryboardExtractionReturn {
  const { jobs: activeJobs } = useTaskSubscription();
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<StoryboardMatchingResult | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // 查找当前剧集的分镜提取任务
  const extractionJob = activeJobs.find(
    (job) =>
      job.id === currentJobId ||
      (job.type === "storyboard_generation" &&
        job.inputData &&
        JSON.parse(job.inputData).episodeId === episodeId)
  ) || null;

  const isExtracting = isStarting || (extractionJob?.status === "pending" || extractionJob?.status === "processing");

  // 启动提取任务
  const startExtraction = useCallback(async () => {
    if (isExtracting) {
      toast.info("任务正在处理中，请稍候");
      return;
    }

    setIsStarting(true);
    try {
      const result = await startStoryboardGeneration(episodeId);
      
      if (result.success && result.jobId) {
        setCurrentJobId(result.jobId);
        toast.success("已启动分镜提取任务");
      } else {
        toast.error(result.error || "启动失败");
      }
    } catch (error) {
      console.error("启动分镜提取失败:", error);
      toast.error("启动失败");
    } finally {
      setIsStarting(false);
    }
  }, [episodeId, isExtracting]);

  // 清除结果
  const clearResult = useCallback(() => {
    setExtractionResult(null);
    setCurrentJobId(null);
  }, []);

  // 监听任务完成
  useEffect(() => {
    if (!extractionJob) return;

    // 任务完成：查找匹配子任务的结果
    if (extractionJob.status === "completed" && extractionJob.resultData) {
      try {
        const parentResult = JSON.parse(extractionJob.resultData);
        const matchingJobId = parentResult.matchingJobId;

        if (matchingJobId) {
          // 查找匹配任务
          const matchingJob = activeJobs.find((j) => j.id === matchingJobId);
          
          if (matchingJob?.status === "completed" && matchingJob.resultData) {
            const result: StoryboardMatchingResult = JSON.parse(matchingJob.resultData);
            setExtractionResult(result);
            onExtractionComplete?.(result);
            toast.success(
              `分镜提取完成！共提取 ${result.shotCount} 个分镜`
            );
          }
        }
      } catch (error) {
        console.error("解析任务结果失败:", error);
        toast.error("解析结果失败");
      }
    }

    // 任务失败
    if (extractionJob.status === "failed") {
      toast.error(extractionJob.errorMessage || "提取失败");
      setCurrentJobId(null);
    }
  }, [extractionJob, activeJobs, onExtractionComplete]);

  return {
    isExtracting,
    extractionJob,
    extractionResult,
    startExtraction,
    clearResult,
  };
}

