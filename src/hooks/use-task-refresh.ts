"use client";

import { useEffect, useRef } from "react";
import type { Job } from "@/types/job";

/**
 * 任务刷新策略配置
 */
interface RefreshStrategy {
  /** 资源类型 */
  type: "shot" | "character" | "scene" | "episode" | "project" | "asset";
  /** 触发刷新的状态 */
  refreshOn: Array<"completed" | "failed" | "processing" | "pending" | "cancelled">;
  /** 是否需要延迟刷新（避免过于频繁） */
  debounce?: number;
}

/**
 * 任务类型 -> 刷新策略映射
 */
const TASK_REFRESH_MAP: Record<string, RefreshStrategy> = {
  // 图片生成
  shot_image_generation: {
    type: "shot",
    refreshOn: ["completed"],
  },
  character_image_generation: {
    type: "character",
    refreshOn: ["completed"],
  },
  scene_image_generation: {
    type: "scene",
    refreshOn: ["completed"],
  },
  batch_image_generation: {
    type: "episode",
    refreshOn: ["completed"],
  },

  // 素材生成
  asset_image_generation: {
    type: "asset",
    refreshOn: ["completed"],
  },

  // 视频生成
  shot_video_generation: {
    type: "shot",
    refreshOn: ["completed"],
  },

  // 提取任务
  character_extraction: {
    type: "project",
    refreshOn: ["completed"],
  },
  scene_extraction: {
    type: "project",
    refreshOn: ["completed"],
  },

  // TTS
  shot_tts_generation: {
    type: "shot",
    refreshOn: ["completed"],
  },
};

/**
 * 刷新回调类型
 */
export interface RefreshCallbacks {
  /** 任务列表（从外部传入，避免创建新的轮询实例） */
  jobs: Job[];
  /** 刷新单个 shot */
  onRefreshShot?: (shotId: string) => Promise<void>;
  /** 刷新单个角色 */
  onRefreshCharacter?: (characterId: string, projectId: string) => Promise<void>;
  /** 刷新单个场景 */
  onRefreshScene?: (sceneId: string, projectId: string) => Promise<void>;
  /** 刷新剧集的所有 shots */
  onRefreshEpisode?: (episodeId: string) => Promise<void>;
  /** 刷新整个项目 */
  onRefreshProject?: (projectId: string) => Promise<void>;
  /** 刷新素材列表 */
  onRefreshAssets?: (projectId: string) => Promise<void>;
}

/**
 * 统一的任务刷新 Hook
 * 
 * 监听任务状态变化，根据任务类型自动刷新相应的资源
 */
export function useTaskRefresh(callbacks: RefreshCallbacks) {
  const { jobs } = callbacks;
  const processedJobsRef = useRef<Set<string>>(new Set());
  const refreshTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // 使用 ref 存储 callbacks，避免 callbacks 对象引用变化导致 effect 重复执行
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const processJobs = async () => {
      for (const job of jobs) {
        // 跳过已处理的任务
        if (!job.id || processedJobsRef.current.has(job.id)) {
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

        // 标记为已处理
        processedJobsRef.current.add(job.id);

        // 解析任务输入数据
        let inputData: Record<string, unknown> = {};
        try {
          inputData = job.inputData ? JSON.parse(job.inputData) : {};
        } catch (error) {
          console.error("解析任务输入数据失败:", error);
          continue;
        }

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

  // 清理已处理任务的记录（避免内存泄漏）
  useEffect(() => {
    // 每隔 5 分钟清理一次已完成任务的记录
    const cleanupInterval = setInterval(() => {
      const completedJobIds = jobs
        .filter(
          (job) =>
            job.status === "completed" ||
            job.status === "failed" ||
            job.status === "cancelled"
        )
        .map((job) => job.id)
        .filter(Boolean) as string[];

      // 保留最近 50 个已完成任务的记录
      if (processedJobsRef.current.size > 100) {
        const idsToKeep = new Set(completedJobIds.slice(-50));
        processedJobsRef.current = new Set(
          Array.from(processedJobsRef.current).filter((id) => idsToKeep.has(id))
        );
      }
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
      case "shot":
        if (callbacks.onRefreshShot && inputData.shotId) {
          await callbacks.onRefreshShot(inputData.shotId as string);
        }
        break;

      case "character":
        if (callbacks.onRefreshCharacter && inputData.characterId && job.projectId) {
          await callbacks.onRefreshCharacter(inputData.characterId as string, job.projectId);
        }
        break;

      case "scene":
        if (callbacks.onRefreshScene && inputData.sceneId && job.projectId) {
          await callbacks.onRefreshScene(inputData.sceneId as string, job.projectId);
        }
        break;

      case "episode":
        if (callbacks.onRefreshEpisode && inputData.episodeId) {
          await callbacks.onRefreshEpisode(inputData.episodeId as string);
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

