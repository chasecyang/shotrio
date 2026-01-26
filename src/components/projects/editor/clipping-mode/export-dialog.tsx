"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Film, Clock, Layers, MonitorPlay, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportTimeline } from "@/lib/actions/timeline/export";
import { TimelineDetail } from "@/types/timeline";
import { formatTimeDisplay } from "@/lib/utils/timeline-utils";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeline: TimelineDetail;
  projectId: string;
}

type ExportQuality = "draft" | "high";

export function ExportDialog({
  open,
  onOpenChange,
  timeline,
  projectId,
}: ExportDialogProps) {
  const t = useTranslations();
  const [quality, setQuality] = useState<ExportQuality>("high");
  const [includeAudio, setIncludeAudio] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // 计算时间轴统计信息
  const videoClipCount = timeline.clips.filter(
    (c) => c.trackIndex < 100
  ).length;
  const audioClipCount = timeline.clips.filter(
    (c) => c.trackIndex >= 100
  ).length;
  const totalClipCount = timeline.clips.length;

  const handleExport = async () => {
    if (totalClipCount === 0) {
      toast.error(t('exportDialog.emptyTimeline'));
      return;
    }

    setIsExporting(true);

    try {
      const result = await exportTimeline(timeline.id, {
        projectId,
        quality,
        includeAudio,
      });

      if (result.success) {
        toast.success(t('exportDialog.exportTaskCreated'));
        onOpenChange(false);
      } else {
        toast.error(result.error || t('exportDialog.createTaskFailed'));
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(t('exportDialog.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            {t('exportDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('exportDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 时间轴信息 */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex flex-col items-center gap-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {formatTimeDisplay(timeline.duration)}
              </span>
              <span className="text-xs text-muted-foreground">{t('exportDialog.duration')}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <MonitorPlay className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{timeline.resolution}</span>
              <span className="text-xs text-muted-foreground">{t('exportDialog.resolution')}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{totalClipCount}</span>
              <span className="text-xs text-muted-foreground">
                {t('exportDialog.clipsDetail', { video: videoClipCount, audio: audioClipCount })}
              </span>
            </div>
          </div>

          {/* 导出选项 */}
          <div className="space-y-4">
            {/* 质量选择 */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('exportDialog.exportQuality')}</Label>
                <p className="text-xs text-muted-foreground">
                  {quality === "draft" ? t('exportDialog.qualityDraft') : t('exportDialog.qualityHigh')}
                </p>
              </div>
              <Select value={quality} onValueChange={(v) => setQuality(v as ExportQuality)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t('exportDialog.draft')}</SelectItem>
                  <SelectItem value="high">{t('exportDialog.high')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 包含音频 */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('exportDialog.includeAudio')}</Label>
                <p className="text-xs text-muted-foreground">
                  {audioClipCount > 0
                    ? t('exportDialog.audioClipsCount', { count: audioClipCount })
                    : t('exportDialog.noAudioInTimeline')}
                </p>
              </div>
              <Switch
                checked={includeAudio}
                onCheckedChange={setIncludeAudio}
                disabled={audioClipCount === 0}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || totalClipCount === 0}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('exportDialog.creatingTask')}
              </>
            ) : (
              t('exportDialog.startExport')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
