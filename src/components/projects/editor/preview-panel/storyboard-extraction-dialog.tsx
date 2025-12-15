"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Film, CheckCircle2, AlertCircle, Users, MapPin, MessageSquare, Trash2 } from "lucide-react";
import { importExtractedShots } from "@/lib/actions/project";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ExtractedShot, ShotSize, CameraMovement, Scene, Character, CharacterImage, EmotionTag, CharacterPosition } from "@/types/project";
import type { StoryboardMatchingResult } from "@/types/job";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { getShotSizeOptions, getCameraMovementOptions, getShotSizeLabel, getCameraMovementLabel, formatDuration } from "@/lib/utils/shot-utils";

interface StoryboardExtractionDialogProps {
  episodeId: string;
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenes?: Scene[];
  characters?: (Character & { images: CharacterImage[] })[];
  onImportSuccess?: () => void;
}

type Step = "loading" | "preview" | "importing" | "success";

export function StoryboardExtractionDialog({
  episodeId,
  jobId,
  open,
  onOpenChange,
  scenes = [],
  characters = [],
  onImportSuccess,
}: StoryboardExtractionDialogProps) {
  const router = useRouter();
  const locale = useLocale();
  const [step, setStep] = useState<Step>("loading");
  const [extractedShots, setExtractedShots] = useState<ExtractedShot[]>([]);
  const [selectedShots, setSelectedShots] = useState<Set<number>>(new Set());
  const [selectedShotIndex, setSelectedShotIndex] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [importResult, setImportResult] = useState<{
    totalShots: number;
    totalCharacters: number;
    totalDialogues: number;
  } | null>(null);

  const shotSizeOptions = getShotSizeOptions();
  const cameraMovementOptions = getCameraMovementOptions();

  // 情绪标签选项
  const emotionOptions = [
    { value: "neutral", label: "中性" },
    { value: "happy", label: "开心" },
    { value: "sad", label: "悲伤" },
    { value: "angry", label: "愤怒" },
    { value: "surprised", label: "惊讶" },
    { value: "fearful", label: "恐惧" },
    { value: "disgusted", label: "厌恶" },
  ];

  // 角色位置选项
  const positionOptions = [
    { value: "left", label: "左侧" },
    { value: "center", label: "中心" },
    { value: "right", label: "右侧" },
    { value: "foreground", label: "前景" },
    { value: "background", label: "背景" },
  ];

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

      // 获取父任务
      const parentResult = await getJobStatus(jobId);

      if (!parentResult.success || !parentResult.job) {
        setError(parentResult.error || "获取任务结果失败");
        return;
      }

      const parentJob = parentResult.job;

      if (parentJob.status !== "completed") {
        setError("任务尚未完成");
        return;
      }

      if (!parentJob.resultData) {
        setError("任务结果为空");
        return;
      }

      // 解析父任务结果，获取匹配任务ID
      const parentData = JSON.parse(parentJob.resultData);
      const matchingJobId = parentData.matchingJobId;

      if (!matchingJobId) {
        setError("未找到匹配任务");
        return;
      }

      // 获取匹配任务结果
      const matchingResult = await getJobStatus(matchingJobId);

      if (!matchingResult.success || !matchingResult.job) {
        setError("获取匹配结果失败");
        return;
      }

      const matchingJob = matchingResult.job;

      if (matchingJob.status !== "completed" || !matchingJob.resultData) {
        setError("匹配任务未完成或结果为空");
        return;
      }

      // 解析提取结果
      const extractionResult: StoryboardMatchingResult = JSON.parse(matchingJob.resultData);

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
    const selectedShotList = Array.from(selectedShots)
      .map(idx => extractedShots[idx])
      .filter(Boolean);

    if (selectedShotList.length === 0) {
      toast.error("请至少选择一个分镜");
      return;
    }

    setStep("importing");

    try {
      const result = await importExtractedShots(episodeId, selectedShotList);

      if (!result.success) {
        toast.error(result.error || "导入失败");
        setStep("preview");
        return;
      }

      setImportResult({
        totalShots: selectedShotList.length,
        totalCharacters: selectedShotList.reduce((sum, shot) => sum + (shot.characters?.length || 0), 0),
        totalDialogues: selectedShotList.reduce((sum, shot) => sum + (shot.dialogues?.length || 0), 0),
      });
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

  const updateCharacter = (shotIndex: number, charIndex: number, updates: Partial<ExtractedShot["characters"][0]>) => {
    const newShots = [...extractedShots];
    const newCharacters = [...newShots[shotIndex].characters];
    newCharacters[charIndex] = { ...newCharacters[charIndex], ...updates };
    newShots[shotIndex] = { ...newShots[shotIndex], characters: newCharacters };
    setExtractedShots(newShots);
  };

  const deleteCharacter = (shotIndex: number, charIndex: number) => {
    const newShots = [...extractedShots];
    const newCharacters = newShots[shotIndex].characters.filter((_, idx) => idx !== charIndex);
    newShots[shotIndex] = { ...newShots[shotIndex], characters: newCharacters };
    setExtractedShots(newShots);
  };

  const updateDialogue = (shotIndex: number, dialogueIndex: number, updates: Partial<ExtractedShot["dialogues"][0]>) => {
    const newShots = [...extractedShots];
    const newDialogues = [...newShots[shotIndex].dialogues];
    newDialogues[dialogueIndex] = { ...newDialogues[dialogueIndex], ...updates };
    newShots[shotIndex] = { ...newShots[shotIndex], dialogues: newDialogues };
    setExtractedShots(newShots);
  };

  const deleteDialogue = (shotIndex: number, dialogueIndex: number) => {
    const newShots = [...extractedShots];
    const newDialogues = newShots[shotIndex].dialogues.filter((_, idx) => idx !== dialogueIndex);
    newShots[shotIndex] = { ...newShots[shotIndex], dialogues: newDialogues };
    setExtractedShots(newShots);
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
                <Film className="w-5 h-5" />
                预览并编辑分镜信息
                <Badge variant="secondary" className="ml-2">
                  共提取 {extractedShots.length} 个分镜
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
              {/* 左侧分镜列表 */}
              <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
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
                      {extractedShots.map((shot, index) => {
                        const hasScene = !!shot.sceneId;
                        const hasCharacters = shot.characters && shot.characters.length > 0;
                        const hasDialogues = shot.dialogues && shot.dialogues.length > 0;
                        const matchedScene = scenes.find(s => s.id === shot.sceneId);
                        const sceneMatchConfidence = shot.sceneMatchConfidence || 0;

                        return (
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
                                  <h4 className="font-medium text-sm">#{shot.order}</h4>
                                  <Badge variant="outline" className="text-[10px] h-4 px-1">
                                    {getShotSizeLabel(shot.shotSize as ShotSize)}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground line-clamp-2">
                                  {shot.visualDescription}
                                </p>
                                {/* 场景信息显示 */}
                                {matchedScene && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <MapPin className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground truncate">
                                      {matchedScene.name}
                                    </span>
                                    {sceneMatchConfidence === 1.0 && (
                                      <Badge variant="outline" className="text-[8px] h-3.5 px-1">
                                        ✓
                                      </Badge>
                                    )}
                                  </div>
                                )}
                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                  {hasCharacters && (
                                    <Badge variant="secondary" className="text-[9px] h-4 px-1">
                                      <Users className="w-2.5 h-2.5 mr-0.5" />
                                      {shot.characters.length}
                                    </Badge>
                                  )}
                                  {hasDialogues && (
                                    <Badge variant="secondary" className="text-[9px] h-4 px-1">
                                      <MessageSquare className="w-2.5 h-2.5 mr-0.5" />
                                      {shot.dialogues.length}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle className="hover:bg-primary/10 transition-colors" />

              {/* 右侧详情编辑 */}
              <ResizablePanel defaultSize={75} minSize={60}>
                <div className="flex flex-col h-full">
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-6 space-y-6">
                      {currentShot && (
                        <>
                          {/* 基本信息 */}
                          <div className="space-y-4">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                              分镜 #{currentShot.order}
                            </h3>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label>景别</Label>
                                <Select
                                  value={currentShot.shotSize}
                                  onValueChange={(value) =>
                                    updateShot(selectedShotIndex, { shotSize: value as ShotSize })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {shotSizeOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
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
                                    updateShot(selectedShotIndex, { cameraMovement: value as CameraMovement })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {cameraMovementOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label>时长（秒）</Label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  value={(currentShot.duration / 1000).toFixed(1)}
                                  onChange={(e) =>
                                    updateShot(selectedShotIndex, { 
                                      duration: Math.round(parseFloat(e.target.value) * 1000) 
                                    })
                                  }
                                />
                              </div>

                              <div>
                                <Label>关联场景</Label>
                                <Select
                                  value={currentShot.sceneId || "none"}
                                  onValueChange={(value) =>
                                    updateShot(selectedShotIndex, { 
                                      sceneId: value === "none" ? undefined : value 
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="选择场景" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">无</SelectItem>
                                    {scenes.map((scene) => (
                                      <SelectItem key={scene.id} value={scene.id}>
                                        {scene.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div>
                              <Label>画面描述（中文）</Label>
                              <Textarea
                                value={currentShot.visualDescription}
                                onChange={(e) =>
                                  updateShot(selectedShotIndex, { visualDescription: e.target.value })
                                }
                                rows={3}
                              />
                            </div>

                            <div>
                              <Label>英文 Prompt（AI 生成用）</Label>
                              <Textarea
                                value={currentShot.visualPrompt}
                                onChange={(e) =>
                                  updateShot(selectedShotIndex, { visualPrompt: e.target.value })
                                }
                                rows={4}
                                className="font-mono text-sm"
                              />
                            </div>

                            <div>
                              <Label>音效描述（可选）</Label>
                              <Textarea
                                value={currentShot.audioPrompt || ""}
                                onChange={(e) =>
                                  updateShot(selectedShotIndex, { audioPrompt: e.target.value || undefined })
                                }
                                rows={2}
                              />
                            </div>
                          </div>

                          <Separator />

                          {/* 角色列表 */}
                          <div className="space-y-4">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              出现角色
                              <Badge variant="secondary" className="text-xs">
                                {currentShot.characters?.length || 0}
                              </Badge>
                            </h3>

                            {currentShot.characters && currentShot.characters.length > 0 ? (
                              <div className="space-y-3">
                                {currentShot.characters.map((char, charIdx) => (
                                  <Card key={charIdx} className="p-4">
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Label>角色: {char.name}</Label>
                                          {char.characterId && (
                                            <Badge 
                                              variant={char.matchConfidence === 1.0 ? "default" : "secondary"}
                                              className="text-[10px] h-4 px-1"
                                            >
                                              {char.matchConfidence === 1.0 ? "精确匹配" : "模糊匹配"}
                                            </Badge>
                                          )}
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => deleteCharacter(selectedShotIndex, charIdx)}
                                        >
                                          <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label className="text-xs">位置</Label>
                                          <Select
                                            value={char.position || "center"}
                                            onValueChange={(value) =>
                                              updateCharacter(selectedShotIndex, charIdx, { 
                                                position: value as CharacterPosition 
                                              })
                                            }
                                          >
                                            <SelectTrigger className="h-8 text-xs">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {positionOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                  {option.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        {char.characterId && characters.length > 0 && (
                                          <div>
                                            <Label className="text-xs">角色造型</Label>
                                            <Select
                                              value={char.characterImageId || "none"}
                                              onValueChange={(value) =>
                                                updateCharacter(selectedShotIndex, charIdx, { 
                                                  characterImageId: value === "none" ? undefined : value 
                                                })
                                              }
                                            >
                                              <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="选择造型" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="none">无</SelectItem>
                                                {characters
                                                  .find(c => c.id === char.characterId)
                                                  ?.images.map((img) => (
                                                    <SelectItem key={img.id} value={img.id}>
                                                      <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded overflow-hidden bg-muted shrink-0">
                                                          {img.imageUrl && (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                              src={img.imageUrl}
                                                              alt={img.label}
                                                              className="w-full h-full object-cover"
                                                            />
                                                          )}
                                                        </div>
                                                        <span>{img.label}</span>
                                                        {img.isPrimary && (
                                                          <Badge variant="outline" className="text-[8px] h-3.5 px-1 ml-auto">
                                                            主
                                                          </Badge>
                                                        )}
                                                      </div>
                                                    </SelectItem>
                                                  ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        )}
                                      </div>

                                      <div>
                                        <Label className="text-xs">动作描述</Label>
                                        <Input
                                          value={char.action || ""}
                                          onChange={(e) =>
                                            updateCharacter(selectedShotIndex, charIdx, { action: e.target.value })
                                          }
                                          className="h-8 text-xs"
                                          placeholder="描述角色的动作..."
                                        />
                                      </div>
                                    </div>
                                  </Card>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">此分镜没有角色</p>
                            )}
                          </div>

                          <Separator />

                          {/* 对话列表 */}
                          <div className="space-y-4 pb-6">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                              <MessageSquare className="w-4 h-4" />
                              对话列表
                              <Badge variant="secondary" className="text-xs">
                                {currentShot.dialogues?.length || 0}
                              </Badge>
                            </h3>

                            {currentShot.dialogues && currentShot.dialogues.length > 0 ? (
                              <div className="space-y-3">
                                {currentShot.dialogues.map((dialogue, dialogueIdx) => (
                                  <Card key={dialogueIdx} className="p-4">
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Label>对话 #{dialogue.order}</Label>
                                          {dialogue.characterName && (
                                            <span className="text-xs text-muted-foreground">
                                              {dialogue.characterName}
                                            </span>
                                          )}
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => deleteDialogue(selectedShotIndex, dialogueIdx)}
                                        >
                                          <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                      </div>

                                      <div>
                                        <Label className="text-xs">对话内容</Label>
                                        <Textarea
                                          value={dialogue.dialogueText}
                                          onChange={(e) =>
                                            updateDialogue(selectedShotIndex, dialogueIdx, { 
                                              dialogueText: e.target.value 
                                            })
                                          }
                                          rows={2}
                                          className="text-xs"
                                        />
                                      </div>

                                      <div>
                                        <Label className="text-xs">情绪</Label>
                                        <Select
                                          value={dialogue.emotionTag || "neutral"}
                                          onValueChange={(value) =>
                                            updateDialogue(selectedShotIndex, dialogueIdx, { 
                                              emotionTag: value as EmotionTag 
                                            })
                                          }
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {emotionOptions.map((option) => (
                                              <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  </Card>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">此分镜没有对话</p>
                            )}
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
              <p className="text-sm text-muted-foreground">
                正在保存分镜信息、角色关联和对话
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
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">分镜:</span>
                  <span className="font-semibold">{importResult.totalShots}</span>
                </div>
                {importResult.totalCharacters > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">角色:</span>
                    <span className="font-semibold">{importResult.totalCharacters}</span>
                  </div>
                )}
                {importResult.totalDialogues > 0 && (
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">对话:</span>
                    <span className="font-semibold">{importResult.totalDialogues}</span>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                正在跳转到时间轴...
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

