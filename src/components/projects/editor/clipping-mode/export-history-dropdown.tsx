"use client";

import { useState, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { retryJob, getCutExportHistory } from "@/lib/actions/job/user-operations";
import { toast } from "sonner";
import {
  Download,
  RotateCcw,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FileVideo,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditor } from "../editor-context";
import { useTranslations } from "next-intl";
import type { Job, FinalVideoExportInput, FinalVideoExportResult } from "@/types/job";

type ExportHistoryStatus = "exporting" | "completed" | "failed" | "cancelled";

interface ExportHistoryItem {
  jobId: string;
  status: ExportHistoryStatus;
  progress: number;
  progressMessage: string | null;
  result: FinalVideoExportResult | null;
  errorMessage: string | null;
  createdAt: Date;
}

function mapJobStatusToHistoryStatus(jobStatus: Job["status"]): ExportHistoryStatus {
  switch (jobStatus) {
    case "pending":
    case "processing":
      return "exporting";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "cancelled";
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatRelativeTime(date: Date, t: ReturnType<typeof useTranslations>): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t("justNow");
  if (diffMins < 60) return `${diffMins} ${t("minutesAgo")}`;
  if (diffHours < 24) return `${diffHours} ${t("hoursAgo")}`;
  return `${diffDays} ${t("daysAgo")}`;
}

interface ExportHistoryDropdownProps {
  cutId: string | null;
}

export function ExportHistoryDropdown({ cutId }: ExportHistoryDropdownProps) {
  const { jobs: activeJobs } = useEditor();
  const [historyJobs, setHistoryJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations("exportHistory");
  const tCommon = useTranslations("common");
  const tToasts = useTranslations("toasts");

  const loadHistory = useCallback(async () => {
    if (!cutId) return;
    setIsLoading(true);
    try {
      const result = await getCutExportHistory(cutId);
      if (result.success && result.jobs) {
        setHistoryJobs(result.jobs);
      }
    } catch (error) {
      console.error("Failed to load export history:", error);
    } finally {
      setIsLoading(false);
    }
  }, [cutId]);

  const history = (() => {
    if (!cutId) return [];

    const activeExportJobs = activeJobs.filter((job) => {
      if (job.type !== "final_video_export") return false;
      const inputData = job.inputData as FinalVideoExportInput | null;
      return inputData?.timelineId === cutId;
    });

    const jobMap = new Map<string, Job>();
    [...activeExportJobs, ...historyJobs].forEach((job) => {
      if (job.id) jobMap.set(job.id, job);
    });

    return Array.from(jobMap.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map((job): ExportHistoryItem => ({
        jobId: job.id,
        status: mapJobStatusToHistoryStatus(job.status),
        progress: job.progress,
        progressMessage: job.progressMessage,
        result: job.status === "completed" ? (job.resultData as FinalVideoExportResult | null) : null,
        errorMessage: job.errorMessage,
        createdAt: new Date(job.createdAt),
      }));
  })();

  const activeCount = history.filter((item) => item.status === "exporting").length;

  const handleDownload = (item: ExportHistoryItem) => {
    if (item.result?.videoUrl) {
      const link = document.createElement("a");
      link.href = item.result.videoUrl;
      link.download = `export-${Date.now()}.mp4`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(t("downloadStarted"));
    }
  };

  const handleRetry = async (jobId: string) => {
    const result = await retryJob(jobId);
    if (result.success) {
      toast.success(tToasts("success.taskResubmitted"));
    } else {
      toast.error(result.error || tToasts("error.retryFailed"));
    }
  };

  return (
    <TooltipProvider>
      <DropdownMenu onOpenChange={(open) => open && loadHistory()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "relative h-7 w-7 p-0 hover:bg-muted/80",
                  activeCount > 0 && "text-blue-500"
                )}
              >
                <History className="h-3.5 w-3.5" />
                {activeCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t("title")}</p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-72 p-0 overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2.5 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <FileVideo className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t("title")}</span>
              {activeCount > 0 && (
                <span className="ml-auto text-xs text-blue-500 font-medium">
                  {activeCount} {t("exporting")}
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="h-auto max-h-[320px]">
            <div className="p-1.5">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileVideo className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm">{t("noHistory")}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {history.map((item) => (
                    <ExportHistoryItemCard
                      key={item.jobId}
                      item={item}
                      onDownload={handleDownload}
                      onRetry={handleRetry}
                      t={t}
                      tCommon={tCommon}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}

interface ExportHistoryItemCardProps {
  item: ExportHistoryItem;
  onDownload: (item: ExportHistoryItem) => void;
  onRetry: (jobId: string) => void;
  t: ReturnType<typeof useTranslations>;
  tCommon: ReturnType<typeof useTranslations>;
}

function ExportHistoryItemCard({ item, onDownload, onRetry, t, tCommon }: ExportHistoryItemCardProps) {
  const isExporting = item.status === "exporting";
  const isCompleted = item.status === "completed";
  const isFailed = item.status === "failed";
  const isCancelled = item.status === "cancelled";

  return (
    <div
      className={cn(
        "group relative rounded-lg px-3 py-2.5 transition-colors",
        isExporting && "bg-blue-500/5",
        isCompleted && "hover:bg-muted/50",
        (isFailed || isCancelled) && "hover:bg-muted/50 opacity-60 hover:opacity-100"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className="mt-0.5 shrink-0">
          {isExporting && (
            <div className="relative">
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            </div>
          )}
          {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          {isFailed && <XCircle className="h-4 w-4 text-red-500" />}
          {isCancelled && <Clock className="h-4 w-4 text-muted-foreground" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Time */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(item.createdAt, tCommon)}
            </span>
            {isCompleted && item.result && (
              <span className="text-xs text-muted-foreground">
                {formatDuration(item.result.duration)} · {formatFileSize(item.result.fileSize)}
              </span>
            )}
          </div>

          {/* Progress Bar for Exporting */}
          {isExporting && (
            <div className="mt-2">
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-300"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                  {item.progressMessage || t("exporting")}
                </span>
                <span className="text-[10px] text-blue-500 font-medium">
                  {item.progress}%
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {isFailed && item.errorMessage && (
            <p className="mt-1 text-[10px] text-red-500 line-clamp-1">
              {item.errorMessage}
            </p>
          )}

          {/* Actions */}
          {(isCompleted || isFailed || isCancelled) && (
            <div className="flex items-center gap-1.5 mt-2">
              {isCompleted && item.result?.videoUrl && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-6 text-[10px] px-2 gap-1"
                  onClick={() => onDownload(item)}
                >
                  <Download className="h-3 w-3" />
                  {t("download")}
                </Button>
              )}
              {(isFailed || isCancelled) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2 gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => onRetry(item.jobId)}
                >
                  <RotateCcw className="h-3 w-3" />
                  {t("retry")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
