"use client";

import { useState } from "react";
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
      toast.error("时间轴为空，无法导出");
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
        toast.success("导出任务已创建，请在后台任务中查看进度");
        onOpenChange(false);
      } else {
        toast.error(result.error || "创建导出任务失败");
      }
    } catch (error) {
      console.error("导出失败:", error);
      toast.error("导出失败，请重试");
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
            导出视频
          </DialogTitle>
          <DialogDescription>
            将时间轴渲染为视频文件
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
              <span className="text-xs text-muted-foreground">时长</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <MonitorPlay className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{timeline.resolution}</span>
              <span className="text-xs text-muted-foreground">分辨率</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{totalClipCount}</span>
              <span className="text-xs text-muted-foreground">
                片段 ({videoClipCount}V/{audioClipCount}A)
              </span>
            </div>
          </div>

          {/* 导出选项 */}
          <div className="space-y-4">
            {/* 质量选择 */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>导出质量</Label>
                <p className="text-xs text-muted-foreground">
                  {quality === "draft" ? "快速预览，较低质量" : "完整渲染，最佳质量"}
                </p>
              </div>
              <Select value={quality} onValueChange={(v) => setQuality(v as ExportQuality)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="high">高清</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 包含音频 */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>包含音频</Label>
                <p className="text-xs text-muted-foreground">
                  {audioClipCount > 0
                    ? `包含 ${audioClipCount} 个音频片段`
                    : "时间轴中没有音频"}
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
            取消
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || totalClipCount === 0}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                创建任务...
              </>
            ) : (
              "开始导出"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
