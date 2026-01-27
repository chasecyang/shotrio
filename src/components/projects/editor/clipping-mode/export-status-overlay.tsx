"use client";

import { useTranslations } from "next-intl";
import { Film, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ExportStatusOverlayProps {
  progress: number;
  progressMessage: string | null;
  onCancel: () => void;
  isCancelling?: boolean;
}

export function ExportStatusOverlay({
  progress,
  progressMessage,
  onCancel,
  isCancelling = false,
}: ExportStatusOverlayProps) {
  const t = useTranslations("exportStatus");

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 p-6 bg-card border rounded-lg shadow-lg">
        <div className="flex flex-col items-center gap-4">
          {/* Icon */}
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Film className="w-8 h-8 text-primary animate-pulse" />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold">{t("exporting")}</h3>

          {/* Progress */}
          <div className="w-full space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{progressMessage || t("preparing")}</span>
              <span>{progress}%</span>
            </div>
          </div>

          {/* Cancel button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isCancelling}
            className="mt-2"
          >
            {isCancelling ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("cancelling")}
              </>
            ) : (
              <>
                <X className="w-4 h-4 mr-2" />
                {t("cancelExport")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
