"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Film, CheckCircle2, AlertCircle, Users, MapPin } from "lucide-react";
import { importExtractedShots } from "@/lib/actions/project/shot";
import { getJobStatus } from "@/lib/actions/job";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ExtractedShot, Character, CharacterImage, Scene } from "@/types/project";
import type { StoryboardGenerationResult } from "@/types/job";
import { useRouter } from "next/navigation";

interface ShotExtractionDialogProps {
  episodeId: string;
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectScenes?: Scene[];
  projectCharacters?: (Character & { images: CharacterImage[] })[];
  onImportSuccess?: () => void;
}

type Step = "loading" | "preview" | "importing" | "success";

// 景别和运镜的中文映射
const SHOT_SIZE_LABELS: Record<string, string> = {
  extreme_long_shot: "大远景",
  long_shot: "远景",
  full_shot: "全景",
  medium_shot: "中景",
  close_up: "特写",
  extreme_close_up: "大特写",
};

const CAMERA_MOVEMENT_LABELS: Record<string, string> = {
  static: "固定",
  push_in: "推镜头",
  pull_out: "拉镜头",
  pan_left: "左摇",
  pan_right: "右摇",
  tilt_up: "上摇",
  tilt_down: "下摇",
  tracking: "跟拍",
  crane_up: "升镜头",
  crane_down: "降镜头",
  orbit: "环绕",
  zoom_in: "变焦推进",
  zoom_out: "变焦拉远",
  handheld: "手持",
};

export function ShotExtractionDialog({
  episodeId,
  jobId,
  open,
  onOpenChange,
  projectScenes = [],
  projectCharacters = [],
  onImportSuccess,
}: ShotExtractionDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [extractedShots, setExtractedShots] = useState<ExtractedShot[]>([]);
  const [selectedShots, setSelectedShots] = useState<Set<number>>(new Set());
  const [selectedShotIndex, setSelectedShotIndex] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [importResult, setImportResult] = useState<{
    newShots: number;
    newCharacterLinks: number;
    newDialogues: number;
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
      // 支持两种格式：
      // 1. 新的两步式：StoryboardMatchingResult（推荐）
      // 2. 旧的单步式：StoryboardGenerationResult（向后兼容）
      const extractionResult: StoryboardGenerationResult = JSON.parse(job.resultData);

      // 如果是父任务，尝试获取匹配任务的结果
      if (job.type === "storyboard_generation" && extractionResult.matchingJobId) {
        const matchingResult = await getJobStatus(extractionResult.matchingJobId);
        if (matchingResult.success && matchingResult.job?.status === "completed" && matchingResult.job.resultData) {
          const matchingData = JSON.parse(matchingResult.job.resultData);
          if (matchingData.shots && matchingData.shots.length > 0) {
            setExtractedShots(matchingData.shots as ExtractedShot[]);
            setSelectedShots(new Set(matchingData.shots.map((_: any, idx: number) => idx)));
            setStep("preview");
            return;
          }
        }
      }

      // 如果是匹配任务或基础提取任务，直接使用其结果
      if (!extractionResult.shots || extractionResult.shots.length === 0) {
        setError("未提取到分镜信息");
        return;
      }

      setExtractedShots(extractionResult.shots as ExtractedShot[]);
      // 默认全选
      setSelectedShots(new Set(extractionResult.shots.map((_, idx) => idx)));
      setStep("preview");
    } catch (err) {
      console.error("加载提取结果失败:", err);
      setError(err instanceof Error ? err.message : "加载失败");
    }
  };

  const handleImport = async () => {
    const selectedShotsData = Array.from(selectedShots)
      .map(idx => extractedShots[idx])
      .filter(Boolean);

    if (selectedShotsData.length === 0) {
      toast.error("请至少选择一个分镜");
      return;
    }

    setStep("importing");

    try {
      const result = await importExtractedShots(episodeId, selectedShotsData);

      if (!result.success) {
        toast.error(result.error || "导入失败");
        setStep("preview");
        return;
      }

      setImportResult(result.imported || null);
      setStep("success");

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

  const toggleShot = (index: number) => {
    const newSelected = new Set(selectedShots);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedShots(newSelected);
  };

  const toggleAll = () => {
    if (selectedShots.size === extractedShots.length) {
      setSelectedShots(new Set());
    } else {
      setSelectedShots(new Set(extractedShots.map((_, idx) => idx)));
    }
  };

  const updateShot = (index: number, updates: Partial<ExtractedShot>) => {
    const newShots = [...extractedShots];
    newShots[index] = { ...newShots[index], ...updates };
    setExtractedShots(newShots);
  };

  const getMatchBadge = (confidence?: number) => {
    if (!confidence || confidence === 0) {
      return <Badge variant="secondary" className="text-[10px] h-4 px-1">未匹配</Badge>;
    }
    if (confidence >= 0.9) {
      return <Badge className="text-[10px] h-4 px-1 bg-green-500">精确匹配</Badge>;
    }
    if (confidence >= 0.7) {
      return <Badge className="text-[10px] h-4 px-1 bg-yellow-500">模糊匹配</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] h-4 px-1">低置信度</Badge>;
  };

  const selectedCount = selectedShots.size;
  const currentShot = extractedShots[selectedShotIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw] h-[90vh] p-0 flex flex-col">
        {step === "loading" && (
          <div className="p-12">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-2xl flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Film className="w-6 h-6 text-primary" />
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
                  <p className="text-sm text-muted-foreground">请稍候</p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "preview" && currentShot && (
          <>
            <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
              <DialogTitle className="text-xl flex items-center gap-2">
                <Film className="w-5 h-5" />
                预览并编辑分镜信息
                <Badge variant="secondary" className="ml-2">
                  共提取 {extractedShots.length} 个分镜
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
              {/* 左侧分镜列表 */}
              <ResizablePanel defaultSize={30} minSize={25} maxSize={40}>
                <div className="flex flex-col h-full">
                  <div className="px-3 py-2.5 border-b flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleAll}
                      className="w-full h-8 text-xs"
                    >
                      {selectedShots.size === extractedShots.length ? "取消全选" : "全选"}
                    </Button>
                  </div>

                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-2 space-y-1.5">
                      {extractedShots.map((shot, index) => (
                        <Card
                          key={index}
                          className={`p-2.5 cursor-pointer transition-all ${
                            selectedShotIndex === index
                              ? "border-primary bg-primary/5"
                              : "hover:border-primary/50"
                          }`}
                          onClick={() => setSelectedShotIndex(index)}
                        >
                          <div className="flex items-start gap-2.5">
                            <Checkbox
                              checked={selectedShots.has(index)}
                              onCheckedChange={() => toggleShot(index)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <h4 className="font-medium text-sm">
                                  镜头 {shot.order}
                                </h4>
                                <Badge variant="outline" className="text-[10px] h-4 px-1">
                                  {SHOT_SIZE_LABELS[shot.shotSize] || shot.shotSize}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-2">
                                {shot.visualDescription}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                {shot.sceneId && (
                                  <MapPin className="w-3 h-3 text-muted-foreground" />
                                )}
                                {shot.characters.filter(c => c.characterId).length > 0 && (
                                  <Users className="w-3 h-3 text-muted-foreground" />
                                )}
                              </div>
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
              <ResizablePanel defaultSize={70} minSize={60}>
                <div className="flex flex-col h-full">
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-6 space-y-6">
                      {/* 基础信息 */}
                      <div className="space-y-4">
                        <h3 className="font-semibold text-lg">基础信息</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>镜头序号</Label>
                            <Input
                              type="number"
                              value={currentShot.order}
                              onChange={(e) =>
                                updateShot(selectedShotIndex, { order: parseInt(e.target.value) || 1 })
                              }
                            />
                          </div>
                          <div>
                            <Label>时长（毫秒）</Label>
                            <Input
                              type="number"
                              value={currentShot.duration}
                              onChange={(e) =>
                                updateShot(selectedShotIndex, { duration: parseInt(e.target.value) || 5000 })
                              }
                            />
                          </div>
                          <div>
                            <Label>景别</Label>
                            <Select
                              value={currentShot.shotSize}
                              onValueChange={(value) =>
                                updateShot(selectedShotIndex, { shotSize: value as any })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(SHOT_SIZE_LABELS).map(([key, label]) => (
                                  <SelectItem key={key} value={key}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>运镜方式</Label>
                            <Select
                              value={currentShot.cameraMovement}
                              onValueChange={(value) =>
                                updateShot(selectedShotIndex, { cameraMovement: value as any })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(CAMERA_MOVEMENT_LABELS).map(([key, label]) => (
                                  <SelectItem key={key} value={key}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* 场景信息 */}
                      <div className="space-y-3">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          场景
                          {currentShot.sceneId && getMatchBadge(currentShot.sceneMatchConfidence)}
                        </h3>
                        <div>
                          <Label>场景名称</Label>
                          <Input
                            value={currentShot.sceneName || ""}
                            onChange={(e) =>
                              updateShot(selectedShotIndex, { sceneName: e.target.value })
                            }
                            placeholder="如：咖啡厅、办公室"
                          />
                        </div>
                        {projectScenes.length > 0 && (
                          <div>
                            <Label>匹配已有场景</Label>
                            <Select
                              value={currentShot.sceneId || "none"}
                              onValueChange={(value) =>
                                updateShot(selectedShotIndex, { 
                                  sceneId: value === "none" ? undefined : value,
                                  sceneMatchConfidence: value === "none" ? 0 : 1.0
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="选择场景" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">不关联场景</SelectItem>
                                {projectScenes.map((scene) => (
                                  <SelectItem key={scene.id} value={scene.id}>
                                    {scene.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* 视觉描述 */}
                      <div className="space-y-3">
                        <h3 className="font-semibold text-lg">视觉描述</h3>
                        <div>
                          <Label>中文描述</Label>
                          <Textarea
                            value={currentShot.visualDescription}
                            onChange={(e) =>
                              updateShot(selectedShotIndex, { visualDescription: e.target.value })
                            }
                            rows={3}
                            placeholder="详细的画面描述..."
                          />
                        </div>
                        <div>
                          <Label>英文Prompt（用于AI生成）</Label>
                          <Textarea
                            value={currentShot.visualPrompt}
                            onChange={(e) =>
                              updateShot(selectedShotIndex, { visualPrompt: e.target.value })
                            }
                            rows={3}
                            className="font-mono text-sm"
                            placeholder="English prompt for AI generation..."
                          />
                        </div>
                        <div>
                          <Label>音频描述</Label>
                          <Textarea
                            value={currentShot.audioPrompt || ""}
                            onChange={(e) =>
                              updateShot(selectedShotIndex, { audioPrompt: e.target.value })
                            }
                            rows={2}
                            placeholder="音效、BGM描述..."
                          />
                        </div>
                      </div>

                      <Separator />

                      {/* 角色列表 */}
                      <div className="space-y-3">
                        <h3 className="font-semibold text-lg">角色</h3>
                        {currentShot.characters.length > 0 ? (
                          <div className="space-y-2">
                            {currentShot.characters.map((char, charIdx) => (
                              <Card key={charIdx} className="p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-medium">{char.name}</span>
                                  {getMatchBadge(char.matchConfidence)}
                                </div>
                                {char.characterId && projectCharacters.length > 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    已匹配角色
                                    {char.characterImageId && " · 已选择造型"}
                                  </div>
                                )}
                                {char.action && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    动作：{char.action}
                                  </div>
                                )}
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">此镜头无角色出现</p>
                        )}
                      </div>

                      <Separator />

                      {/* 对话列表 */}
                      <div className="space-y-3">
                        <h3 className="font-semibold text-lg">对话</h3>
                        {currentShot.dialogues.length > 0 ? (
                          <div className="space-y-2">
                            {currentShot.dialogues.map((dialogue, dialogueIdx) => (
                              <Card key={dialogueIdx} className="p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium">
                                    {dialogue.characterName || "旁白"}
                                  </span>
                                  {dialogue.characterId && getMatchBadge(dialogue.matchConfidence)}
                                  {dialogue.emotionTag && (
                                    <Badge variant="outline" className="text-[10px]">
                                      {dialogue.emotionTag}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm">{dialogue.dialogueText}</p>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">此镜头无对话</p>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>

            {/* 底部操作栏 */}
            <div className="p-4 border-t bg-muted/30 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  已选择 <span className="font-semibold text-foreground">{selectedCount}</span> 个分镜
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
              <p className="text-lg font-medium">正在导入分镜...</p>
              <p className="text-sm text-muted-foreground">正在保存分镜信息、角色关联和对话</p>
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
                <div>
                  <div className="text-2xl font-bold text-primary">{importResult.newShots}</div>
                  <div className="text-muted-foreground">新增分镜</div>
                </div>
                {importResult.newCharacterLinks > 0 && (
                  <div>
                    <div className="text-2xl font-bold text-blue-500">{importResult.newCharacterLinks}</div>
                    <div className="text-muted-foreground">角色关联</div>
                  </div>
                )}
                {importResult.newDialogues > 0 && (
                  <div>
                    <div className="text-2xl font-bold text-green-500">{importResult.newDialogues}</div>
                    <div className="text-muted-foreground">对话条数</div>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground">正在刷新页面...</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
