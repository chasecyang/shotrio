"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskProgressBar } from "./task-progress-bar";
import { RotateCcw, X as XIcon, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessageKey } from "@/lib/utils/error-sanitizer";
import type { Job } from "@/types/job";
import { 
  getTaskTypeLabel, 
  getTaskStatusConfig, 
  VIEWABLE_TASK_TYPES,
  formatTaskTime 
} from "@/lib/constants/task-labels";

interface TaskItemProps {
  job: Partial<Job>;
  children?: Job[]; // 子任务列表
  onCancel?: (jobId: string) => void;
  onRetry?: (jobId: string) => void;
  onView?: (jobId: string) => void;
  depth?: number; // 嵌套深度
}

export function TaskItem({ 
  job, 
  children = [], 
  onCancel, 
  onRetry, 
  onView,
  depth = 0 
}: TaskItemProps) {
  const t = useTranslations();
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = children.length > 0;
  
  const taskType = getTaskTypeLabel(job.type || "", t, "md");
  const status = getTaskStatusConfig(job.status || "pending", t, "md");

  const canCancel = job.status === "pending" || job.status === "processing";
  const canRetry = job.status === "failed" || job.status === "cancelled";
  
  // 只有已完成且支持查看的任务类型才显示"查看结果"按钮
  const canView = job.status === "completed" && 
                  job.type && 
                  VIEWABLE_TASK_TYPES.includes(job.type) &&
                  !job.isImported; // 已导入的任务不再显示查看按钮

  // 计算子任务统计
  const childStats = hasChildren
    ? {
        total: children.length,
        active: children.filter(
          (c) => c.status === "pending" || c.status === "processing"
        ).length,
        completed: children.filter((c) => c.status === "completed").length,
        failed: children.filter((c) => c.status === "failed").length,
        cancelled: children.filter((c) => c.status === "cancelled").length,
      }
    : null;

  return (
    <div className="space-y-2">
      <Card className={cn(
        "p-4 hover:shadow-md transition-shadow",
        depth > 0 && "ml-8 border-l-2 border-l-primary/30"
      )}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* 展开/折叠按钮 */}
            {hasChildren ? (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="shrink-0 hover:bg-accent rounded p-1 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            ) : (
              <div className="w-6" /> /* 占位符，保持对齐 */
            )}
            
            {taskType.icon}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-medium text-sm truncate">{taskType.label}</h4>
                {/* 显示子任务统计 */}
                {childStats && (
                  <div className="flex items-center gap-1">
                    {childStats.active > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {childStats.active} 进行中
                      </Badge>
                    )}
                    {childStats.completed > 0 && (
                      <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400">
                        {childStats.completed} 完成
                      </Badge>
                    )}
                    {childStats.failed > 0 && (
                      <Badge variant="outline" className="text-xs text-red-600 dark:text-red-400">
                        {childStats.failed} 失败
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{formatTaskTime(job.createdAt)}</p>
            </div>
          </div>
          
          <Badge
            variant="outline"
            className={cn("flex items-center gap-1 ml-2", status.color)}
          >
            {status.icon}
            <span className="text-xs">{status.label}</span>
          </Badge>
        </div>

        {/* Progress */}
        {(job.status === "pending" || job.status === "processing") && (
          <div>
            <TaskProgressBar
              progress={job.progress || 0}
              status={job.status}
              currentStep={job.currentStep}
              totalSteps={job.totalSteps}
            />
            {job.progressMessage && (
              <p className="text-xs text-muted-foreground mt-1">
                {job.progressMessage}
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {job.status === "failed" && job.errorMessage && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md p-2">
            <p className="text-xs text-red-600 dark:text-red-400">
              {t(getErrorMessageKey(job.errorMessage))}
            </p>
          </div>
        )}

        {/* Actions */}
        {(canCancel || canRetry || canView) && (
          <div className="flex items-center gap-2 pt-1">
            {canView && onView && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onView(job.id!)}
              >
                查看结果
              </Button>
            )}
            
            {canRetry && onRetry && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onRetry(job.id!)}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                重试
              </Button>
            )}

            {canCancel && onCancel && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground hover:text-destructive ml-auto"
                onClick={() => onCancel(job.id!)}
              >
                <XIcon className="w-3 h-3 mr-1" />
                取消
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>

      {/* 递归渲染子任务 */}
      {hasChildren && isExpanded && (
        <div className="space-y-2">
          {children.map((childJob) => (
            <TaskItem
              key={childJob.id}
              job={childJob}
              onCancel={onCancel}
              onRetry={onRetry}
              onView={onView}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
