"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import { importExtractedScenes } from "@/lib/actions/scene";
import { getJobStatus } from "@/lib/actions/job";
import { markJobAsImported } from "@/lib/actions/job/user-operations";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { ExtractedScene } from "@/types/project";
import type { SceneExtractionResult } from "@/types/job";
import { useRouter } from "next/navigation";

interface SceneExtractionDialogProps {
  projectId: string;
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingScenes?: Array<{ id: string; name: string }>;
  onImportSuccess?: () => void;
}

type Step = "loading" | "preview" | "importing" | "success";

export function SceneExtractionDialog({
  projectId,
  jobId,
  open,
  onOpenChange,
  existingScenes = [],
  onImportSuccess,
}: SceneExtractionDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [extractedScenes, setExtractedScenes] = useState<ExtractedScene[]>([]);
  const [selectedScenes, setSelectedScenes] = useState<Set<number>>(new Set());
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [importResult, setImportResult] = useState<{
    newScenes: number;
    skippedScenes: number;
  } | null>(null);

  // 加载任务结果
  useEffect(() => {
    if (open && jobId && step === "loading") {
      loadExtractionResult();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId, step]);

  const loadExtractionResult = async () => {
    try {
      setError("");
      
      // 获取任务状态和结果
      const result = await getJobStatus(jobId);

      if (!result.success || !result.job) {
        setError(result.error || "获取任务结果失败");
        return;
      }

      const job = result.job;

      if (job.status !== "completed") {
        setError("任务尚未完成");
        return;
      }

      if (!job.resultData) {
        setError("任务结果为空");
        return;
      }

      // 解析提取结果
      const extractionResult: SceneExtractionResult = JSON.parse(job.resultData);

      if (!extractionResult.scenes || extractionResult.scenes.length === 0) {
        setError("未提取到场景信息");
        return;
      }

      // 标记已存在的场景
      const existingNames = new Set(
        existingScenes.map(s => s.name.toLowerCase().trim())
      );

      const scenesWithStatus = extractionResult.scenes.map(scene => {
        const isExisting = existingNames.has(scene.name.toLowerCase().trim());
        return {
          ...scene,
          isExisting,
          existingId: isExisting 
            ? existingScenes.find(s => s.name.toLowerCase().trim() === scene.name.toLowerCase().trim())?.id 
            : undefined,
        };
      });

      setExtractedScenes(scenesWithStatus);
      // 默认只选中新场景
      const newSceneIndices = scenesWithStatus
        .map((scene, idx) => (!scene.isExisting ? idx : -1))
        .filter(idx => idx !== -1);
      setSelectedScenes(new Set(newSceneIndices));
      setStep("preview");
    } catch (err) {
      console.error("加载提取结果失败:", err);
      setError(err instanceof Error ? err.message : "加载失败");
    }
  };

  const handleImport = async () => {
    const selectedScenesData = Array.from(selectedScenes)
      .map(idx => extractedScenes[idx])
      .filter(Boolean);

    if (selectedScenesData.length === 0) {
      toast.error("请至少选择一个场景");
      return;
    }

    setStep("importing");

    try {
      const result = await importExtractedScenes(projectId, selectedScenesData);

      if (!result.success) {
        toast.error(result.error || "导入失败");
        setStep("preview");
        return;
      }

      setImportResult(result.imported || null);
      setStep("success");

      // 标记任务为已导入
      await markJobAsImported(jobId);

      // 立即调用回调通知父组件
      onImportSuccess?.();

      // 3秒后自动关闭并刷新
      setTimeout(() => {
        onOpenChange(false);
        router.refresh();
      }, 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导入失败");
      setStep("preview");
    }
  };

  const toggleScene = (index: number) => {
    const newSelected = new Set(selectedScenes);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedScenes(newSelected);
  };

  const toggleAll = () => {
    if (selectedScenes.size === extractedScenes.length) {
      setSelectedScenes(new Set());
    } else {
      setSelectedScenes(new Set(extractedScenes.map((_, idx) => idx)));
    }
  };

  const updateScene = (index: number, updates: Partial<ExtractedScene>) => {
    const newScenes = [...extractedScenes];
    newScenes[index] = { ...newScenes[index], ...updates };
    setExtractedScenes(newScenes);
  };

  const selectedCount = selectedScenes.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw] h-[90vh] p-0 flex flex-col">
        {step === "loading" && (
          <div className="p-12">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-2xl flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                加载提取结果
              </DialogTitle>
            </DialogHeader>

            {error ? (
              <div className="space-y-6">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-destructive mb-1">加载失败</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                    关闭
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-center">
                  <Loader2 className="w-16 h-16 text-primary animate-spin" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">正在加载提取结果...</p>
                  <p className="text-sm text-muted-foreground">
                    请稍候
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "preview" && (
          <>
            <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
              <DialogTitle className="text-xl flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                预览并编辑场景信息
                <Badge variant="secondary" className="ml-2">
                  共提取 {extractedScenes.length} 个场景
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
              {/* 左侧场景列表 */}
              <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
                <div className="flex flex-col h-full">
                  <div className="px-3 py-2.5 border-b flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleAll}
                      className="w-full h-8 text-xs"
                    >
                      {selectedScenes.size === extractedScenes.length ? "取消全选" : "全选"}
                    </Button>
                  </div>

                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-2 space-y-1.5">
                      {extractedScenes.map((scene, index) => (
                        <Card
                          key={index}
                          className={`p-2.5 cursor-pointer transition-all ${
                            selectedSceneIndex === index
                              ? "border-primary bg-primary/5"
                              : "hover:border-primary/50"
                          }`}
                          onClick={() => setSelectedSceneIndex(index)}
                        >
                          <div className="flex items-start gap-2.5">
                            <Checkbox
                              checked={selectedScenes.has(index)}
                              onCheckedChange={() => toggleScene(index)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <h4 className="font-medium text-sm truncate">{scene.name}</h4>
                                {scene.isExisting ? (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                    已存在
                                  </Badge>
                                ) : (
                                  <Badge className="text-[10px] h-4 px-1 bg-green-500">
                                    新
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-2">
                                {scene.description}
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle className="hover:bg-primary/10 transition-colors" />

              {/* 右侧详情编辑 */}
              <ResizablePanel defaultSize={65} minSize={50}>
                <div className="flex flex-col h-full">
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-6 space-y-6">
                      {extractedScenes[selectedSceneIndex] && (
                        <>
                          {/* 基本信息 */}
                          <div className="space-y-4">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                              场景信息
                              {extractedScenes[selectedSceneIndex].isExisting && (
                                <Badge variant="outline" className="text-xs">
                                  已存在，将跳过导入
                                </Badge>
                              )}
                            </h3>

                            <div className="space-y-3">
                              <div>
                                <Label>场景名称</Label>
                                <Input
                                  value={extractedScenes[selectedSceneIndex].name}
                                  onChange={(e) =>
                                    updateScene(selectedSceneIndex, { name: e.target.value })
                                  }
                                  disabled={extractedScenes[selectedSceneIndex].isExisting}
                                />
                              </div>

                              <div>
                                <Label>场景描述</Label>
                                <Textarea
                                  value={extractedScenes[selectedSceneIndex].description}
                                  onChange={(e) =>
                                    updateScene(selectedSceneIndex, { description: e.target.value })
                                  }
                                  rows={8}
                                  disabled={extractedScenes[selectedSceneIndex].isExisting}
                                  placeholder="场景的详细描述，包括环境、氛围、关键道具等..."
                                />
                              </div>
                            </div>
                          </div>

                          <Separator />

                          {/* 提示信息 */}
                          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                            <h4 className="font-medium text-sm">💡 提示</h4>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              <li>• 导入后，您可以为场景生成&ldquo;全景布局图&rdquo;和&ldquo;叙事主力视角&rdquo;</li>
                              <li>• 场景名称建议使用具体的地点描述，如&ldquo;咖啡厅-靠窗位置&rdquo;</li>
                              <li>• 场景描述越详细，AI生成的场景图片效果越好</li>
                            </ul>
                          </div>
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>

            {/* 底部操作栏 */}
            <div className="p-4 border-t bg-muted/30 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  已选择 <span className="font-semibold text-foreground">{selectedCount}</span> 个场景
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    取消
                  </Button>
                  <Button onClick={handleImport} disabled={selectedCount === 0}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    确认导入
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {step === "importing" && (
          <div className="p-12">
            <div className="flex items-center justify-center mb-6">
              <Loader2 className="w-16 h-16 text-primary animate-spin" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">正在导入场景...</p>
              <p className="text-sm text-muted-foreground">
                正在保存场景信息
              </p>
            </div>
          </div>
        )}

        {step === "success" && importResult && (
          <div className="p-12">
            <div className="flex items-center justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
            </div>

            <div className="text-center space-y-4">
              <h3 className="text-2xl font-semibold">导入成功！</h3>
              
              <div className="flex items-center justify-center gap-6 text-sm">
                {importResult.newScenes > 0 && (
                  <div>
                    <div className="text-2xl font-bold text-primary">{importResult.newScenes}</div>
                    <div className="text-muted-foreground">新增场景</div>
                  </div>
                )}
                {importResult.skippedScenes > 0 && (
                  <div>
                    <div className="text-2xl font-bold text-muted-foreground">{importResult.skippedScenes}</div>
                    <div className="text-muted-foreground">已存在</div>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                正在刷新页面...
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

