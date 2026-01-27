"use client";

import { useTranslations } from "next-intl";
import { CheckCircle, Download, RefreshCw, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FinalVideoExportResult } from "@/types/job";

/**
 * Format file size in bytes to human readable string
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

interface ExportResultPanelProps {
  result: FinalVideoExportResult;
  onDownload: () => void;
  onDismiss: () => void;
  onNewExport: () => void;
  isDownloading?: boolean;
}

export function ExportResultPanel({
  result,
  onDownload,
  onDismiss,
  onNewExport,
  isDownloading = false,
}: ExportResultPanelProps) {
  const t = useTranslations("exportStatus");

  // Format duration from seconds to mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95">
      <div className="w-full max-w-2xl mx-4 flex flex-col gap-6">
        {/* Video preview */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            src={result.videoUrl}
            controls
            className="w-full h-full object-contain"
            poster={result.videoUrl}
          />
        </div>

        {/* Success card */}
        <div className="p-6 bg-card border rounded-lg">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold">{t("exportComplete")}</h3>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                <span>
                  {t("duration")}: {formatDuration(result.duration)}
                </span>
                <span>
                  {t("fileSize")}: {formatFileSize(result.fileSize)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={onDownload} disabled={isDownloading}>
              {isDownloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {t("download")}
            </Button>
            <Button variant="outline" onClick={onNewExport}>
              <RefreshCw className="w-4 h-4 mr-2" />
              {t("newExport")}
            </Button>
            <Button variant="ghost" onClick={onDismiss}>
              {t("continueEditing")}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ExportFailedPanelProps {
  errorMessage: string | null;
  onRetry: () => void;
  onDismiss: () => void;
  isRetrying?: boolean;
}

export function ExportFailedPanel({
  errorMessage,
  onRetry,
  onDismiss,
  isRetrying = false,
}: ExportFailedPanelProps) {
  const t = useTranslations("exportStatus");

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 p-6 bg-card border rounded-lg shadow-lg">
        <div className="flex flex-col items-center gap-4">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold">{t("exportFailed")}</h3>

          {/* Error message */}
          {errorMessage && (
            <p className="text-sm text-muted-foreground text-center">
              {errorMessage}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-2">
            <Button onClick={onRetry} disabled={isRetrying}>
              {isRetrying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {t("retry")}
            </Button>
            <Button variant="outline" onClick={onDismiss}>
              {t("dismiss")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
