"use client";

import { memo } from "react";
import type { TaskExecution } from "@/types/agent";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFunctionDefinition } from "@/lib/actions/agent/functions";

interface TaskStatusCardProps {
  task: TaskExecution;
}

export const TaskStatusCard = memo(function TaskStatusCard({ task }: TaskStatusCardProps) {
  // 获取 displayName
  const funcDef = getFunctionDefinition(task.functionName);
  const displayName = funcDef?.displayName || task.functionName;

  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className="mt-0.5">
          {task.status === "running" && (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          )}
          {task.status === "completed" && (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
          {task.status === "failed" && (
            <XCircle className="h-5 w-5 text-red-500" />
          )}
          {task.status === "pending" && (
            <Clock className="h-5 w-5 text-yellow-500" />
          )}
        </div>

        {/* Task Info */}
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium">{displayName}</h4>
            <span
              className={cn(
                "text-xs font-medium",
                task.status === "running" && "text-blue-600",
                task.status === "completed" && "text-green-600",
                task.status === "failed" && "text-red-600",
                task.status === "pending" && "text-yellow-600"
              )}
            >
              {getStatusText(task.status)}
            </span>
          </div>

          {/* Progress */}
          {task.status === "running" && task.progress !== undefined && (
            <div className="space-y-1">
              <Progress value={task.progress} className="h-1.5" />
              {task.progressMessage && (
                <p className="text-xs text-muted-foreground">{task.progressMessage}</p>
              )}
            </div>
          )}

          {/* Result/Error */}
          {task.status === "completed" && (
            <p className="text-xs text-green-600">✓ 已完成</p>
          )}
          {task.status === "failed" && task.error && (
            <p className="text-xs text-red-600">{task.error}</p>
          )}

          {/* Time Info */}
          <p className="text-xs text-muted-foreground">
            开始于 {new Date(task.startedAt).toLocaleTimeString("zh-CN")}
            {task.completedAt && (
              <> · 耗时 {Math.round((task.completedAt.getTime() - task.startedAt.getTime()) / 1000)}秒</>
            )}
          </p>
        </div>
      </div>
    </Card>
  );
});

function getStatusText(status: TaskExecution["status"]): string {
  switch (status) {
    case "pending":
      return "等待中";
    case "running":
      return "执行中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    default:
      return "未知";
  }
}

