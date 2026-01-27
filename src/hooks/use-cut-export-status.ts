"use client";

import { useMemo } from "react";
import { useEditor } from "@/components/projects/editor/editor-context";
import type { Job, FinalVideoExportInput, FinalVideoExportResult } from "@/types/job";

export type CutExportStatus = "idle" | "exporting" | "completed" | "failed";

export interface CutExportState {
  status: CutExportStatus;
  jobId: string | null;
  progress: number;
  progressMessage: string | null;
  result: FinalVideoExportResult | null;
  errorMessage: string | null;
}

function mapJobStatusToExportStatus(jobStatus: Job["status"]): CutExportStatus {
  switch (jobStatus) {
    case "pending":
    case "processing":
      return "exporting";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "idle";
    default:
      return "idle";
  }
}

/**
 * Hook to track export status for the current cut
 * Monitors jobs from EditorContext and filters for final_video_export jobs
 * matching the current cutId (timelineId)
 */
export function useCutExportStatus(cutId: string | null): CutExportState {
  const { jobs } = useEditor();

  return useMemo(() => {
    if (!cutId) {
      return {
        status: "idle",
        jobId: null,
        progress: 0,
        progressMessage: null,
        result: null,
        errorMessage: null,
      };
    }

    // Find the most recent export job for this cut
    const exportJobs = jobs.filter((job) => {
      if (job.type !== "final_video_export") return false;
      const inputData = job.inputData as FinalVideoExportInput | null;
      return inputData?.timelineId === cutId;
    });

    // Sort by createdAt descending to get the most recent
    const sortedJobs = exportJobs.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const exportJob = sortedJobs[0];

    if (!exportJob) {
      return {
        status: "idle",
        jobId: null,
        progress: 0,
        progressMessage: null,
        result: null,
        errorMessage: null,
      };
    }

    const status = mapJobStatusToExportStatus(exportJob.status);
    const result = status === "completed"
      ? (exportJob.resultData as FinalVideoExportResult | null)
      : null;

    return {
      status,
      jobId: exportJob.id,
      progress: exportJob.progress,
      progressMessage: exportJob.progressMessage,
      result,
      errorMessage: exportJob.errorMessage,
    };
  }, [jobs, cutId]);
}
