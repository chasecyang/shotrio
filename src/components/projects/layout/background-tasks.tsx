"use client";

import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskProgressBar } from "@/components/tasks/task-progress-bar";
import { useTaskSubscription } from "@/hooks/use-task-subscription";
import { getUserJobs, cancelJob, retryJob } from "@/lib/actions/job/user-operations";
import { getJobsDetails, type JobDetails } from "@/lib/actions/job/details";
import { toast } from "sonner";
import {
  Activity,
  Loader2,
  CheckCircle2,
  XCircle,
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

const taskTypeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  novel_split: {
    label: "小说拆分",
    icon: <BookOpen className="w-3.5 h-3.5" />,
  },
  character_extraction: {
    label: "角色提取",
    icon: <Users className="w-3.5 h-3.5" />,
  },
  character_image_generation: {
    label: "角色造型生成",
    icon: <Sparkles className="w-3.5 h-3.5" />,
  },
  storyboard_generation: {
    label: "剧本自动分镜",
    icon: <Film className="w-3.5 h-3.5" />,
  },
  batch_image_generation: {
    label: "批量图像生成",
    icon: <Images className="w-3.5 h-3.5" />,
  },
  video_generation: {
    label: "视频生成",
    icon: <Video className="w-3.5 h-3.5" />,
  },
};

const statusConfig: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  pending: {
    label: "等待中",
    icon: <Clock className="w-3.5 h-3.5" />,
    color: "text-yellow-600 dark:text-yellow-400",
  },
  processing: {
    label: "处理中",
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    color: "text-blue-600 dark:text-blue-400",
  },
  completed: {
    label: "已完成",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    color: "text-green-600 dark:text-green-400",
  },
  failed: {
    label: "失败",
    icon: <XCircle className="w-3.5 h-3.5" />,
    color: "text-red-600 dark:text-red-400",
  },
  cancelled: {
    label: "已取消",
    icon: <Ban className="w-3.5 h-3.5" />,
    color: "text-gray-600 dark:text-gray-400",
  },
};

export function BackgroundTasks() {
  const { jobs: activeJobs } = useTaskSubscription();
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [jobDetails, setJobDetails] = useState<Map<string, JobDetails>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // 加载最近的任务（包括已完成和失败的）
  const loadRecentJobs = async () => {
    setIsLoading(true);
    try {
      const result = await getUserJobs({ limit: 10 });
      if (result.success && result.jobs) {
        const jobs = result.jobs as Job[];
        setRecentJobs(jobs);
        
        // 获取所有任务的详细信息
        const allJobs = [...activeJobs, ...jobs];
        const details = await getJobsDetails(allJobs);
        setJobDetails(details);
      }
    } catch (error) {
      console.error("加载任务失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 当活动任务变化时，更新它们的详细信息
  useEffect(() => {
    if (activeJobs.length > 0) {
      getJobsDetails(activeJobs).then(setJobDetails);
    }
  }, [activeJobs]);

  // 合并活动任务和历史任务，活动任务置顶
  const allJobs = [
    ...activeJobs,
    ...recentJobs.filter(
      (job) => !activeJobs.some((activeJob) => activeJob.id === job.id)
    ),
  ].slice(0, 10);

  const activeCount = activeJobs.length;

  // 取消任务
  const handleCancel = async (jobId: string) => {
    const result = await cancelJob(jobId);
    if (result.success) {
      toast.success("任务已取消");
    } else {
      toast.error(result.error || "取消失败");
    }
  };

  // 重试任务
  const handleRetry = async (jobId: string) => {
    const result = await retryJob(jobId);
    if (result.success) {
      toast.success("任务已重新提交");
    } else {
      toast.error(result.error || "重试失败");
    }
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && loadRecentJobs()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative h-9 w-9 p-0 transition-colors",
            activeCount > 0 && "text-primary"
          )}
        >
          <Activity className="h-4 w-4" />
          {activeCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[380px]">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">后台任务</h4>
            {activeCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                {activeCount} 个进行中
              </Badge>
            )}
          </div>
        </div>

        <DropdownMenuSeparator />

        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : allJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Activity className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">暂无任务</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {allJobs.map((job) => (
                <TaskItemCompact
                  key={job.id}
                  job={job}
                  details={jobDetails.get(job.id || "")}
                  onCancel={handleCancel}
                  onRetry={handleRetry}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface TaskItemCompactProps {
  job: Partial<Job>;
  details?: JobDetails;
  onCancel: (jobId: string) => void;
  onRetry: (jobId: string) => void;
}

function TaskItemCompact({ job, details, onCancel, onRetry }: TaskItemCompactProps) {
  const taskType = taskTypeLabels[job.type || ""];
  const status = statusConfig[job.status || "pending"];

  const canCancel = job.status === "pending" || job.status === "processing";
  const canRetry = job.status === "failed" || job.status === "cancelled";

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

  const isCompleted = job.status === "completed" || job.status === "failed" || job.status === "cancelled";

  // 使用详细信息或回退到默认标签
  const taskTypeLabel = taskTypeLabels[job.type || ""]?.label || "未知任务";
  const displayTitle = details?.displayTitle || taskTypeLabel;
  const displaySubtitle = details?.displaySubtitle;
  
  // 如果有详细信息，显示任务类型作为标签
  const showTypeLabel = details && details.displayTitle !== taskTypeLabel;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 space-y-2 transition-all hover:shadow-sm",
        isCompleted && "opacity-60 hover:opacity-100"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {taskType?.icon}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h5 className="font-medium text-xs truncate">
                {displayTitle}
              </h5>
              {showTypeLabel && (
                <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">
                  {taskTypeLabel}
                </span>
              )}
            </div>
            {displaySubtitle && (
              <p className="text-[10px] text-muted-foreground truncate">
                {displaySubtitle}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">{getTimeText()}</p>
          </div>
        </div>

        <div className={cn("flex items-center gap-1", status.color)}>
          {status.icon}
          <span className="text-[10px] font-medium">{status.label}</span>
        </div>
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
            <p className="text-[10px] text-muted-foreground mt-1">
              {job.progressMessage}
            </p>
          )}
        </div>
      )}

      {/* Error Message */}
      {job.status === "failed" && job.errorMessage && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded px-2 py-1">
          <p className="text-[10px] text-red-600 dark:text-red-400 line-clamp-2">
            {job.errorMessage}
          </p>
        </div>
      )}

      {/* Actions */}
      {(canCancel || canRetry) && (
        <div className="flex items-center gap-2">
          {canRetry && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2"
              onClick={() => onRetry(job.id!)}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              重试
            </Button>
          )}

          {canCancel && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 text-muted-foreground hover:text-destructive ml-auto"
              onClick={() => onCancel(job.id!)}
            >
              <XIcon className="w-3 h-3 mr-1" />
              取消
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
