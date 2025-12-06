"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskProgressBar } from "./task-progress-bar";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Ban,
  RotateCcw,
  X as XIcon,
  BookOpen,
  Users,
  Sparkles,
  Film,
  Images,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Job } from "@/types/job";

interface TaskItemProps {
  job: Partial<Job>;
  onCancel?: (jobId: string) => void;
  onRetry?: (jobId: string) => void;
  onView?: (jobId: string) => void;
}

const taskTypeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  novel_split: {
    label: "小说拆分",
    icon: <BookOpen className="w-4 h-4" />,
  },
  character_extraction: {
    label: "角色提取",
    icon: <Users className="w-4 h-4" />,
  },
  character_image_generation: {
    label: "角色造型生成",
    icon: <Sparkles className="w-4 h-4" />,
  },
  storyboard_generation: {
    label: "剧本自动分镜",
    icon: <Film className="w-4 h-4" />,
  },
  batch_image_generation: {
    label: "批量图像生成",
    icon: <Images className="w-4 h-4" />,
  },
  video_generation: {
    label: "视频生成",
    icon: <Video className="w-4 h-4" />,
  },
};

const statusConfig: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  pending: {
    label: "等待中",
    icon: <Clock className="w-4 h-4" />,
    color: "text-yellow-600 dark:text-yellow-400",
  },
  processing: {
    label: "处理中",
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    color: "text-blue-600 dark:text-blue-400",
  },
  completed: {
    label: "已完成",
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "text-green-600 dark:text-green-400",
  },
  failed: {
    label: "失败",
    icon: <XCircle className="w-4 h-4" />,
    color: "text-red-600 dark:text-red-400",
  },
  cancelled: {
    label: "已取消",
    icon: <Ban className="w-4 h-4" />,
    color: "text-gray-600 dark:text-gray-400",
  },
};

export function TaskItem({ job, onCancel, onRetry, onView }: TaskItemProps) {
  const taskType = taskTypeLabels[job.type || ""];
  const status = statusConfig[job.status || "pending"];

  const canCancel = job.status === "pending" || job.status === "processing";
  const canRetry = job.status === "failed" || job.status === "cancelled";
  const canView = job.status === "completed";

  const getTimeText = () => {
    if (!job.createdAt) return "";
    
    try {
      return formatDistanceToNow(new Date(job.createdAt), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch {
      return "";
    }
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {taskType?.icon}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{taskType?.label || "未知任务"}</h4>
              <p className="text-xs text-muted-foreground">{getTimeText()}</p>
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
              {job.errorMessage}
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
  );
}

