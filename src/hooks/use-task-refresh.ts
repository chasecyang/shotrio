"use client";

import { useEffect, useRef } from "react";
import type { Job } from "@/types/job";

/**
 * 任务刷新策略配置
 */
interface RefreshStrategy {
  /** 资源类型 */
  type: "video" | "project" | "asset";
  /** 触发刷新的状态 */
  refreshOn: Array<"completed" | "failed" | "processing" | "pending" | "cancelled">;
  /** 是否需要延迟刷新（避免过于频繁） */
  debounce?: number;
}

/**
 * 任务类型 -> 刷新策略映射
 */
const TASK_REFRESH_MAP: Record<string, RefreshStrategy> = {
  // 素材图片生成
  asset_image: {
    type: "asset",
    refreshOn: ["pending", "processing", "completed", "failed"],
    debounce: 300, // 防抖300ms，避免过于频繁刷新
  },

  // 素材视频生成
  asset_video: {
    type: "asset",
    refreshOn: ["pending", "processing", "completed", "failed"],
    debounce: 500, // 防抖500ms，避免过于频繁刷新
  },

  // 素材音频生成
  asset_audio: {
    type: "asset",
    refreshOn: ["pending", "processing", "completed", "failed"],
    debounce: 300,
  },

  // 最终导出
  final_video_export: {
    type: "video",
    refreshOn: ["completed", "failed"],
  },
};

/**
 * 刷新回调类型
 */
export interface RefreshCallbacks {
  /** 任务列表（从外部传入，避免创建新的轮询实例） */
  jobs: Job[];
  /** 刷新单个视频 */
  onRefreshVideo?: (videoId: string) => Promise<void>;
  /** 刷新整个项目 */
  onRefreshProject?: (projectId: string) => Promise<void>;
  /** 刷新素材列表 */
  onRefreshAssets?: (projectId: string) => Promise<void>;
}

/**
 * 统一的任务刷新 Hook
 * 
 * 监听任务状态变化，根据任务类型自动刷新相应的资源
 * 
 * 优化：
 * - 追踪每个任务的状态变化，而不是只标记是否处理过
 * - 只在状态真正变化时才触发刷新
 * - 确保任务完成时一定会刷新
 */
export function useTaskRefresh(callbacks: RefreshCallbacks) {
  const { jobs } = callbacks;
  // 追踪每个任务的最后状态（jobId -> status）
  const jobStatusMapRef = useRef<Map<string, string>>(new Map());
  const refreshTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // 使用 ref 存储 callbacks，避免 callbacks 对象引用变化导致 effect 重复执行
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const processJobs = async () => {
      for (const job of jobs) {
        if (!job.id) {
          continue;
        }

        // 获取任务的刷新策略
        const strategy = TASK_REFRESH_MAP[job.type || ""];
        if (!strategy) {
          continue;
        }

        // 检查任务状态是否匹配刷新条件
        if (!strategy.refreshOn.includes(job.status)) {
          continue;
        }

        // 获取上次记录的状态
        const lastStatus = jobStatusMapRef.current.get(job.id);
        
        // 如果状态没有变化，跳过（避免重复刷新）
        if (lastStatus === job.status) {
          continue;
        }

        // 更新状态记录
        jobStatusMapRef.current.set(job.id, job.status);

        console.log(`[useTaskRefresh] 任务 ${job.id} 状态变化: ${lastStatus || '新任务'} -> ${job.status}`);

        // 获取任务输入数据（JSONB 已由 Drizzle 自动解析）
        // 使用类型守卫确保类型安全
        const inputData = (job.inputData as Record<string, unknown> | null) || {};

        // 防抖处理（如果配置了）
        const refreshKey = `${job.type}-${job.id}`;
        if (strategy.debounce) {
          const existingTimer = refreshTimersRef.current.get(refreshKey);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          const timer = setTimeout(async () => {
            await executeRefresh(strategy.type, inputData, callbacksRef.current, job);
            refreshTimersRef.current.delete(refreshKey);
          }, strategy.debounce);

          refreshTimersRef.current.set(refreshKey, timer);
        } else {
          // 立即执行刷新
          await executeRefresh(strategy.type, inputData, callbacksRef.current, job);
        }
      }
    };

    processJobs();

    // 清理定时器
    const timers = refreshTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [jobs]);

  // 清理已完成任务的状态记录（避免内存泄漏）
  useEffect(() => {
    // 每隔 5 分钟清理一次已完成任务的记录
    const cleanupInterval = setInterval(() => {
      const currentJobIds = new Set(jobs.map((job) => job.id).filter(Boolean));
      
      // 移除不在当前任务列表中的记录
      for (const [jobId] of jobStatusMapRef.current) {
        if (!currentJobIds.has(jobId)) {
          jobStatusMapRef.current.delete(jobId);
        }
      }

      console.log(`[useTaskRefresh] 清理状态记录，当前追踪 ${jobStatusMapRef.current.size} 个任务`);
    }, 5 * 60 * 1000);

    return () => clearInterval(cleanupInterval);
  }, [jobs]);
}

/**
 * 执行刷新操作
 */
async function executeRefresh(
  type: RefreshStrategy["type"],
  inputData: Record<string, unknown>,
  callbacks: RefreshCallbacks,
  job: Partial<Job>
) {
  try {
    switch (type) {
      case "video":
        // final_video_export 任务是项目级别的导出，刷新整个项目
        if (callbacks.onRefreshProject && job.projectId) {
          await callbacks.onRefreshProject(job.projectId);
        }
        break;

      case "project":
        if (callbacks.onRefreshProject && job.projectId) {
          await callbacks.onRefreshProject(job.projectId);
        }
        break;

      case "asset":
        if (callbacks.onRefreshAssets && job.projectId) {
          await callbacks.onRefreshAssets(job.projectId);
        }
        break;
    }
  } catch (error) {
    console.error(`刷新资源失败 (${type}):`, error);
  }
}

