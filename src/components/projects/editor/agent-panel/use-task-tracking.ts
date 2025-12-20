"use client";

/**
 * Task Tracking Hook
 * 
 * 监听 Job 的状态变化，同步更新 Agent 的任务状态
 */

import { useEffect, useRef } from "react";
import { useAgent } from "../agent-panel/agent-context";
import { useEditor } from "../editor-context";
import type { Job } from "@/types/job";

export function useTaskTracking() {
  const agent = useAgent();
  const editor = useEditor();
  const prevJobsRef = useRef<Record<string, Job>>({});

  useEffect(() => {
    // 将 jobs 数组转换为 map，方便比较
    const currentJobsMap: Record<string, Job> = {};
    editor.jobs.forEach((job) => {
      currentJobsMap[job.id] = job;
    });

    // 检查每个任务的变化
    agent.state.runningTasks.forEach((task) => {
      if (!task.jobId) return;

      const currentJob = currentJobsMap[task.jobId];
      const prevJob = prevJobsRef.current[task.jobId];

      // 如果 job 状态发生变化
      if (currentJob && (!prevJob || currentJob.status !== prevJob.status)) {
        if (currentJob.status === "processing") {
          // 更新为执行中
          agent.updateTask(task.id, {
            status: "running",
            progress: currentJob.progress,
            progressMessage: currentJob.progressMessage || undefined,
          });
        } else if (currentJob.status === "completed") {
          // 更新为已完成
          agent.updateTask(task.id, {
            status: "completed",
            progress: 100,
            progressMessage: "已完成",
            completedAt: currentJob.completedAt || new Date(),
          });

          // 3秒后自动移除已完成的任务
          setTimeout(() => {
            agent.removeTask(task.id);
          }, 3000);
        } else if (currentJob.status === "failed") {
          // 更新为失败
          agent.updateTask(task.id, {
            status: "failed",
            error: currentJob.errorMessage || "任务失败",
            completedAt: new Date(),
          });

          // 10秒后自动移除失败的任务
          setTimeout(() => {
            agent.removeTask(task.id);
          }, 10000);
        }
      }

      // 如果是执行中，更新进度
      if (currentJob && currentJob.status === "processing") {
        if (
          currentJob.progress !== task.progress ||
          currentJob.progressMessage !== task.progressMessage
        ) {
          agent.updateTask(task.id, {
            progress: currentJob.progress,
            progressMessage: currentJob.progressMessage || undefined,
          });
        }
      }
    });

    // 保存当前状态供下次比较
    prevJobsRef.current = currentJobsMap;
  }, [editor.jobs, agent]);
}

