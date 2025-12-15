"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getUserJobs } from "@/lib/actions/job/user-operations";
import type { Job } from "@/types/job";

/**
 * 任务轮询 Hook - 替代 SSE
 * 
 * 特性：
 * - 智能三级轮询间隔：
 *   - 有活动任务时 5 秒（快速更新）
 *   - 最近有完成的任务（5分钟内）时 30 秒（中速）
 *   - 完全空闲时 60 秒（低速）
 * - 自动重试机制
 * - 组件卸载时自动清理
 * - 避免循环依赖导致的过度轮询
 */
export function useTaskPolling() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 使用 ref 存储最新的 jobs 状态，避免 useEffect 依赖导致的循环
  const jobsRef = useRef<Job[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);

  const fetchJobs = useCallback(async () => {
    if (!isActiveRef.current) return;

    try {
      // 获取活跃任务（pending, processing）
      const activeResult = await getUserJobs({
        status: ["pending", "processing"],
        limit: 50,
      });

      if (!activeResult.success) {
        throw new Error(activeResult.error || "获取任务失败");
      }

      // 获取最近完成的任务（最近 5 分钟）
      const completedResult = await getUserJobs({
        status: ["completed", "failed", "cancelled"],
        limit: 15,
      });

      const activeJobs = activeResult.jobs || [];
      const completedJobs = (completedResult.jobs || []).filter((job) => {
        if (!job.updatedAt) return false;
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        return new Date(job.updatedAt).getTime() > fiveMinutesAgo;
      });

      // 合并任务（去重）
      const jobMap = new Map<string, Job>();
      [...activeJobs, ...completedJobs].forEach((job) => {
        if (job.id) {
          jobMap.set(job.id, job);
        }
      });

      const mergedJobs = Array.from(jobMap.values());
      
      // 同时更新 state 和 ref
      jobsRef.current = mergedJobs;
      setJobs(mergedJobs);
      setError(null);
      setIsLoading(false);
    } catch (err) {
      console.error("获取任务失败:", err);
      setError(err instanceof Error ? err.message : "获取任务失败");
      setIsLoading(false);
    }
  }, []);

  // 启动轮询
  useEffect(() => {
    isActiveRef.current = true;

    // 立即执行一次
    fetchJobs();

    // 设置定时轮询
    const scheduleNext = () => {
      if (!isActiveRef.current) return;

      // 实时检查 jobsRef.current 获取最新状态，避免闭包问题
      const hasActiveJobs = jobsRef.current.some(
        (job) => job.status === "pending" || job.status === "processing"
      );

      // 检查是否有最近完成的任务（5分钟内）
      const hasRecentCompleted = jobsRef.current.some((job) => {
        if (!job.updatedAt) return false;
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        const updatedTime = new Date(job.updatedAt).getTime();
        return (
          updatedTime > fiveMinutesAgo &&
          (job.status === "completed" || job.status === "failed" || job.status === "cancelled")
        );
      });

      // 三级轮询策略
      let interval: number;
      if (hasActiveJobs) {
        interval = 5000;   // 5秒 - 有活动任务时快速更新
      } else if (hasRecentCompleted) {
        interval = 30000;  // 30秒 - 有最近完成的任务时中速更新
      } else {
        interval = 60000;  // 60秒 - 完全空闲时低速更新
      }

      timerRef.current = setTimeout(async () => {
        await fetchJobs();
        scheduleNext();
      }, interval);
    };

    scheduleNext();

    // 清理函数
    return () => {
      isActiveRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fetchJobs]); // 只依赖 fetchJobs，不依赖 jobs

  // 手动刷新
  const refresh = useCallback(() => {
    fetchJobs();
  }, [fetchJobs]);

  return {
    jobs,
    isLoading,
    error,
    refresh,
  };
}

