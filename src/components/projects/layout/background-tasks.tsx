"use client";

import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TaskProgressBar } from "@/components/tasks/task-progress-bar";
import { getUserJobs, cancelJob, retryJob } from "@/lib/actions/job/user-operations";
import { getJobsDetails, type JobDetails } from "@/lib/actions/job/details";
import { toast } from "sonner";
import { useEditor } from "../editor/editor-context";
import {
  Activity,
  Loader2,
  RotateCcw,
  X as XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job, FinalVideoExportResult } from "@/types/job";
import {
  getTaskTypeLabel,
  getTaskStatusConfig,
  VIEWABLE_TASK_TYPES,
  formatTaskTime
} from "@/lib/constants/task-labels";
import { useTranslations } from "next-intl";

export function BackgroundTasks() {
  const { jobs: activeJobs } = useEditor();
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [jobDetails, setJobDetails] = useState<Map<string, JobDetails>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations("toasts");
  const tTasks = useTranslations("backgroundTasks");

  // Load recent tasks (including completed and failed)
  const loadRecentJobs = async () => {
    setIsLoading(true);
    try {
      const result = await getUserJobs({ limit: 10 });
      if (result.success && result.jobs) {
        const jobs = result.jobs as Job[];
        setRecentJobs(jobs);

        // Get details for all tasks
        const allJobs = [...activeJobs, ...jobs];
        const details = await getJobsDetails(allJobs);
        setJobDetails(details);
      }
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update details when active tasks change
  useEffect(() => {
    if (activeJobs.length > 0) {
      getJobsDetails(activeJobs).then(setJobDetails);
    }
  }, [activeJobs]);

  // Merge active tasks and history tasks, active tasks on top
  const allJobs = [
    ...activeJobs,
    ...recentJobs.filter(
      (job) => !activeJobs.some((activeJob) => activeJob.id === job.id)
    ),
  ];

  // Only show first 10 tasks
  const displayedJobs = allJobs.slice(0, 10);

  // Count active tasks
  const activeCount = allJobs.filter(
    (job) => job.status === "pending" || job.status === "processing"
  ).length;

  // Cancel task
  const handleCancel = async (jobId: string) => {
    const result = await cancelJob(jobId);
    if (result.success) {
      toast.success(t("success.taskCancelled"));
    } else {
      toast.error(result.error || t("error.cancelFailed"));
    }
  };

  // Retry task
  const handleRetry = async (jobId: string) => {
    const result = await retryJob(jobId);
    if (result.success) {
      toast.success(t("success.taskResubmitted"));
    } else {
      toast.error(result.error || t("error.retryFailed"));
    }
  };

  // View result (based on task type)
  const handleView = async (jobId: string) => {
    const job = allJobs.find((j) => j.id === jobId);
    if (!job) {
      toast.error(tTasks("taskNotFound"));
      return;
    }

    // Handle based on task type
    try {
      switch (job.type) {
        case "final_video_export": {
          const result = job.resultData as FinalVideoExportResult | null;
          if (result?.videoUrl) {
            // Trigger download
            const link = document.createElement("a");
            link.href = result.videoUrl;
            link.download = `export-${Date.now()}.mp4`;
            link.target = "_blank";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(tTasks("downloadStarted"));
          } else {
            toast.error(tTasks("exportUrlNotFound"));
          }
          break;
        }
        default:
          toast.info(tTasks("viewNotSupported"));
          break;
      }
    } catch (error) {
      console.error("Failed to parse task data:", error);
      toast.error(tTasks("parseDataFailed"));
    }
  };

  return (
    <TooltipProvider>
      <DropdownMenu onOpenChange={(open) => open && loadRecentJobs()}>
        <Tooltip>
          <TooltipTrigger asChild>
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
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {tTasks("title")}
              {activeCount > 0 && ` (${activeCount} ${tTasks("inProgress")})`}
            </p>
          </TooltipContent>
        </Tooltip>

      <DropdownMenuContent align="end" className="w-[380px]">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{tTasks("title")}</h4>
            {activeCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                {activeCount} {tTasks("inProgress")}
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
          ) : displayedJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Activity className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">{tTasks("noTasks")}</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {displayedJobs.map((job) => (
                <TaskItem
                  key={job.id}
                  job={job}
                  details={jobDetails.get(job.id || "")}
                  onCancel={handleCancel}
                  onRetry={handleRetry}
                  onView={handleView}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
    </TooltipProvider>
  );
}

interface TaskItemProps {
  job: Partial<Job>;
  details?: JobDetails;
  onCancel: (jobId: string) => void;
  onRetry: (jobId: string) => void;
  onView: (jobId: string) => void;
}

function TaskItem({
  job,
  details,
  onCancel,
  onRetry,
  onView,
}: TaskItemProps) {
  const t = useTranslations();
  const tTasks = useTranslations("backgroundTasks");
  const taskType = getTaskTypeLabel(job.type || "", t, "sm");
  const status = getTaskStatusConfig(job.status || "pending", t, "sm");

  const canCancel = job.status === "pending" || job.status === "processing";
  const canRetry = job.status === "failed" || job.status === "cancelled";

  // Only show "View Result" button for completed tasks with viewable types
  const canView = job.status === "completed" &&
                  job.type &&
                  VIEWABLE_TASK_TYPES.includes(job.type) &&
                  !job.isImported;

  const isCompleted = job.status === "completed" || job.status === "failed" || job.status === "cancelled";

  // Use details or fallback to default label
  const displayTitle = details?.displayTitle || taskType.label;
  const displaySubtitle = details?.displaySubtitle;

  // Show task type as label if there are details
  const showTypeLabel = details && details.displayTitle !== taskType.label;

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
          {taskType.icon}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h5 className="font-medium text-xs truncate">
                {displayTitle}
              </h5>
              {showTypeLabel && (
                <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">
                  {taskType.label}
                </span>
              )}
            </div>
            {displaySubtitle && (
              <p className="text-[10px] text-muted-foreground truncate">
                {displaySubtitle}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">{formatTaskTime(job.createdAt)}</p>
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
      {(canCancel || canRetry || canView) && (
        <div className="flex items-center gap-2">
          {canView && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2"
              onClick={() => onView(job.id!)}
            >
              {tTasks("viewResult")}
            </Button>
          )}

          {canRetry && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2"
              onClick={() => onRetry(job.id!)}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              {tTasks("retry")}
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
              {tTasks("cancel")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
