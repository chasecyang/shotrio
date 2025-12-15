"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Film, CheckCircle2, AlertCircle, Scissors, Sparkles, Maximize2, Clock, MessageSquare } from "lucide-react";
import { importDecomposedShots } from "@/lib/actions/storyboard/import-decomposed-shots";
import { getJobStatus } from "@/lib/actions/job";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { ShotDecompositionResult } from "@/types/job";
import { getShotSizeLabel, getCameraMovementLabel, formatDuration } from "@/lib/utils/shot-utils";
import { useRouter } from "next/navigation";

interface ShotDecompositionDialogProps {
  shotId: string;
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: () => void;
}

type Step = "loading" | "preview" | "importing" | "success";

export function ShotDecompositionDialog({
  shotId,
  jobId,
  open,
  onOpenChange,
  onImportSuccess,
}: ShotDecompositionDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [decompositionResult, setDecompositionResult] = useState<ShotDecompositionResult | null>(null);
  const [error, setError] = useState<string>("");

  // 加载任务结果
  useEffect(() => {
    if (open && jobId && step === "loading") {
      loadDecompositionResult();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId, step]);

  const loadDecompositionResult = async () => {
    try {
      setError("");

      // 获取任务结果
      const jobResult = await getJobStatus(jobId);

      if (!jobResult.success || !jobResult.job) {
        setError(jobResult.error || "获取任务结果失败");
        return;
      }

      if (jobResult.job.status !== "completed") {
        setError("任务尚未完成");
        return;
      }

      if (!jobResult.job.resultData) {
        setError("任务结果为空");
        return;
      }

      // 解析拆解结果
      const result: ShotDecompositionResult = JSON.parse(jobResult.job.resultData);

      if (!result.decomposedShots || result.decomposedShots.length === 0) {
        setError("拆解结果为空");
        return;
      }

      setDecompositionResult(result);
      setStep("preview");
    } catch (error) {
      console.error("加载拆解结果失败:", error);
      setError(error instanceof Error ? error.message : "加载失败");
    }
  };

  // 导入拆解结果
  const handleImport = async () => {
    if (!decompositionResult) return;

    setStep("importing");

    try {
      const result = await importDecomposedShots({
        jobId,
      });

      if (result.success) {
        setStep("success");
        toast.success("分镜拆解完成！");

        // 延迟关闭对话框并刷新
        setTimeout(() => {
          onOpenChange(false);
          onImportSuccess?.();
          router.refresh();
        }, 2000);
      } else {
        setError(result.error || "导入失败");
        setStep("preview");
        toast.error(result.error || "导入失败");
      }
    } catch (error) {
      console.error("导入失败:", error);
      setError(error instanceof Error ? error.message : "导入失败");
      setStep("preview");
      toast.error("导入失败");
    }
  };

  // 渲染加载状态
  if (step === "loading") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">正在加载拆解方案...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 渲染错误状态
  if (error && step !== "importing") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              加载失败
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">{error}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
            <Button onClick={loadDecompositionResult}>
              重试
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 渲染导入中状态
  if (step === "importing") {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium mb-2">正在导入拆解结果...</p>
            <p className="text-sm text-muted-foreground">请稍候，正在更新分镜数据...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 渲染成功状态
  if (step === "success") {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="max-w-2xl">
          <div className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <p className="text-2xl font-semibold mb-2">拆解完成！</p>
            <p className="text-muted-foreground">分镜已成功拆解</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 渲染预览状态
  if (!decompositionResult) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Scissors className="w-5 h-5" />
            <Sparkles className="w-5 h-5 text-primary" />
            分镜拆解预览
          </DialogTitle>
          <DialogDescription>
            AI 已将此分镜拆解为 <strong>{decompositionResult.decomposedCount}</strong> 个子分镜
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-200px)]">
          <div className="space-y-6 pr-4">
            {/* AI 拆解理由 */}
            {decompositionResult.reasoningExplanation && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    AI 分析
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {decompositionResult.reasoningExplanation}
                  </p>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* 拆解后的分镜列表 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Film className="w-4 h-4" />
                拆解后的分镜 ({decompositionResult.decomposedCount} 个)
              </h3>

              {decompositionResult.decomposedShots.map((subShot, index) => (
                <Card key={index} className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="default" className="font-mono px-3">
                        #{decompositionResult.originalOrder + index}
                      </Badge>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Maximize2 className="w-3.5 h-3.5" />
                        {getShotSizeLabel(subShot.shotSize as any)}
                        <span>•</span>
                        {getCameraMovementLabel(subShot.cameraMovement as any)}
                        <span>•</span>
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(subShot.duration)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* 视觉描述 */}
                    <div>
                      <p className="text-sm font-medium mb-1">画面描述</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {subShot.visualDescription}
                      </p>
                    </div>

                    {/* 对话 */}
                    {subShot.dialogues && subShot.dialogues.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                          <p className="text-sm font-medium">对话</p>
                          <Badge variant="secondary" className="text-xs">
                            {subShot.dialogues.length}
                          </Badge>
                        </div>
                        <div className="space-y-2 pl-5">
                          {subShot.dialogues.map((dlg, dlgIndex) => (
                            <div key={dlgIndex} className="text-sm">
                              <span className="text-muted-foreground">
                                {dlg.characterId ? "角色" : "旁白"}:
                              </span>{" "}
                              <span>{dlg.dialogueText}</span>
                              {dlg.emotionTag && dlg.emotionTag !== "neutral" && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {dlg.emotionTag}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </ScrollArea>

        {/* 底部操作按钮 */}
        <div className="flex justify-between items-center gap-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            确认后将删除原分镜，并插入 {decompositionResult.decomposedCount} 个新分镜
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleImport} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              确认拆解
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

