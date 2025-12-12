"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Users, CheckCircle2, AlertCircle, Trash2, Plus } from "lucide-react";
import { importExtractedCharacters } from "@/lib/actions/character";
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
import type { ExtractedCharacter, ExtractedCharacterStyle } from "@/types/project";
import type { CharacterExtractionResult } from "@/types/job";
import { useRouter } from "next/navigation";

interface CharacterExtractionDialogProps {
  projectId: string;
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCharacters?: Array<{ id: string; name: string }>;
  onImportSuccess?: () => void;
}

type Step = "loading" | "preview" | "importing" | "success";

export function CharacterExtractionDialog({
  projectId,
  jobId,
  open,
  onOpenChange,
  existingCharacters = [],
  onImportSuccess,
}: CharacterExtractionDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [extractedCharacters, setExtractedCharacters] = useState<ExtractedCharacter[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<Set<number>>(new Set());
  const [selectedCharIndex, setSelectedCharIndex] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [importResult, setImportResult] = useState<{
    newCharacters: number;
    newStyles: number;
    updatedCharacters: number;
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
      const extractionResult: CharacterExtractionResult = JSON.parse(job.resultData);

      if (!extractionResult.characters || extractionResult.characters.length === 0) {
        setError("未提取到角色信息");
        return;
      }

      // 标记已存在的角色
      const existingNames = new Set(
        existingCharacters.map(c => c.name.toLowerCase().trim())
      );

      const charactersWithStatus = extractionResult.characters.map(char => {
        const isExisting = existingNames.has(char.name.toLowerCase().trim());
        return {
          ...char,
          isExisting,
          existingId: isExisting 
            ? existingCharacters.find(c => c.name.toLowerCase().trim() === char.name.toLowerCase().trim())?.id 
            : undefined,
          newStylesCount: char.styles.length,
        };
      });

      setExtractedCharacters(charactersWithStatus);
      // 默认全选
      setSelectedCharacters(new Set(charactersWithStatus.map((_, idx) => idx)));
      setStep("preview");
    } catch (err) {
      console.error("加载提取结果失败:", err);
      setError(err instanceof Error ? err.message : "加载失败");
    }
  };

  const handleImport = async () => {
    const selectedChars = Array.from(selectedCharacters)
      .map(idx => extractedCharacters[idx])
      .filter(Boolean);

    if (selectedChars.length === 0) {
      toast.error("请至少选择一个角色");
      return;
    }

    setStep("importing");

    try {
      const result = await importExtractedCharacters(projectId, selectedChars);

      if (!result.success) {
        toast.error(result.error || "导入失败");
        setStep("preview");
        return;
      }

      setImportResult(result.imported || null);
      setStep("success");

      // 立即调用回调通知父组件
      onImportSuccess?.();

      // 3秒后自动关闭并跳转
      setTimeout(() => {
        onOpenChange(false);
        router.push(`/${projectId}/characters?fromExtraction=true`);
        router.refresh();
      }, 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导入失败");
      setStep("preview");
    }
  };

  const toggleCharacter = (index: number) => {
    const newSelected = new Set(selectedCharacters);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedCharacters(newSelected);
  };

  const toggleAll = () => {
    if (selectedCharacters.size === extractedCharacters.length) {
      setSelectedCharacters(new Set());
    } else {
      setSelectedCharacters(new Set(extractedCharacters.map((_, idx) => idx)));
    }
  };

  const updateCharacter = (index: number, updates: Partial<ExtractedCharacter>) => {
    const newChars = [...extractedCharacters];
    newChars[index] = { ...newChars[index], ...updates };
    setExtractedCharacters(newChars);
  };

  const updateStyle = (charIndex: number, styleIndex: number, updates: Partial<ExtractedCharacterStyle>) => {
    const newChars = [...extractedCharacters];
    const newStyles = [...newChars[charIndex].styles];
    newStyles[styleIndex] = { ...newStyles[styleIndex], ...updates };
    newChars[charIndex] = { ...newChars[charIndex], styles: newStyles };
    setExtractedCharacters(newChars);
  };

  const deleteStyle = (charIndex: number, styleIndex: number) => {
    const newChars = [...extractedCharacters];
    const newStyles = newChars[charIndex].styles.filter((_, idx) => idx !== styleIndex);
    newChars[charIndex] = { ...newChars[charIndex], styles: newStyles };
    setExtractedCharacters(newChars);
  };

  const addStyle = (charIndex: number) => {
    const newChars = [...extractedCharacters];
    newChars[charIndex].styles.push({
      label: "新造型",
      prompt: "",
    });
    setExtractedCharacters(newChars);
  };

  const selectedCount = selectedCharacters.size;
  const totalStylesCount = Array.from(selectedCharacters)
    .reduce((sum, idx) => sum + extractedCharacters[idx].styles.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw] h-[90vh] p-0 flex flex-col">
        {step === "loading" && (
          <div className="p-12">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-2xl flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
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
                <Users className="w-5 h-5" />
                预览并编辑角色信息
                <Badge variant="secondary" className="ml-2">
                  共提取 {extractedCharacters.length} 个角色
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
              {/* 左侧角色列表 */}
              <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
                <div className="flex flex-col h-full">
                  <div className="px-3 py-2.5 border-b flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleAll}
                      className="w-full h-8 text-xs"
                    >
                      {selectedCharacters.size === extractedCharacters.length ? "取消全选" : "全选"}
                    </Button>
                  </div>

                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-2 space-y-1.5">
                      {extractedCharacters.map((char, index) => (
                        <Card
                          key={index}
                          className={`p-2.5 cursor-pointer transition-all ${
                            selectedCharIndex === index
                              ? "border-primary bg-primary/5"
                              : "hover:border-primary/50"
                          }`}
                          onClick={() => setSelectedCharIndex(index)}
                        >
                          <div className="flex items-start gap-2.5">
                            <Checkbox
                              checked={selectedCharacters.has(index)}
                              onCheckedChange={() => toggleCharacter(index)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <h4 className="font-medium text-sm truncate">{char.name}</h4>
                                {char.isExisting ? (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                    已存在
                                  </Badge>
                                ) : (
                                  <Badge className="text-[10px] h-4 px-1 bg-green-500">
                                    新
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-1">
                                {char.description}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {char.styles.length} 个造型
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
              <ResizablePanel defaultSize={75} minSize={60}>
                <div className="flex flex-col h-full">
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-6 space-y-6">
                      {extractedCharacters[selectedCharIndex] && (
                        <>
                          {/* 基本信息 */}
                          <div className="space-y-4">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                              基本信息
                              {extractedCharacters[selectedCharIndex].isExisting && (
                                <Badge variant="outline" className="text-xs">
                                  将添加 {extractedCharacters[selectedCharIndex].newStylesCount} 个新造型
                                </Badge>
                              )}
                            </h3>

                            <div className="space-y-3">
                              <div>
                                <Label>角色名称</Label>
                                <Input
                                  value={extractedCharacters[selectedCharIndex].name}
                                  onChange={(e) =>
                                    updateCharacter(selectedCharIndex, { name: e.target.value })
                                  }
                                />
                              </div>

                              <div>
                                <Label>性格描述</Label>
                                <Textarea
                                  value={extractedCharacters[selectedCharIndex].description}
                                  onChange={(e) =>
                                    updateCharacter(selectedCharIndex, { description: e.target.value })
                                  }
                                  rows={3}
                                />
                              </div>

                              <div>
                                <Label>基础外貌（固定特征）</Label>
                                <Textarea
                                  value={extractedCharacters[selectedCharIndex].appearance}
                                  onChange={(e) =>
                                    updateCharacter(selectedCharIndex, { appearance: e.target.value })
                                  }
                                  rows={3}
                                  placeholder="如：黑色长发、蓝色瞳孔、身高170cm..."
                                />
                              </div>
                            </div>
                          </div>

                          <Separator />

                          {/* 造型列表 */}
                          <div className="space-y-4 pb-6">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-lg">造型设定</h3>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addStyle(selectedCharIndex)}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                添加造型
                              </Button>
                            </div>

                            <div className="space-y-3">
                              {extractedCharacters[selectedCharIndex].styles.map((style, styleIdx) => (
                                <Card key={styleIdx} className="p-4">
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <Label>造型名称</Label>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => deleteStyle(selectedCharIndex, styleIdx)}
                                      >
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </div>
                                    <Input
                                      value={style.label}
                                      onChange={(e) =>
                                        updateStyle(selectedCharIndex, styleIdx, { label: e.target.value })
                                      }
                                      placeholder="如：日常装、工作装、晚礼服..."
                                    />

                                    <div>
                                      <Label>图像生成 Prompt（英文）</Label>
                                      <Textarea
                                        value={style.prompt}
                                        onChange={(e) =>
                                          updateStyle(selectedCharIndex, styleIdx, { prompt: e.target.value })
                                        }
                                        rows={4}
                                        placeholder="详细的英文图像生成描述..."
                                        className="font-mono text-sm"
                                      />
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
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
                  已选择 <span className="font-semibold text-foreground">{selectedCount}</span> 个角色，
                  共 <span className="font-semibold text-foreground">{totalStylesCount}</span> 个造型
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
              <p className="text-lg font-medium">正在导入角色...</p>
              <p className="text-sm text-muted-foreground">
                正在保存角色信息和造型描述
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
                {importResult.newCharacters > 0 && (
                  <div>
                    <div className="text-2xl font-bold text-primary">{importResult.newCharacters}</div>
                    <div className="text-muted-foreground">新增角色</div>
                  </div>
                )}
                {importResult.updatedCharacters > 0 && (
                  <div>
                    <div className="text-2xl font-bold text-blue-500">{importResult.updatedCharacters}</div>
                    <div className="text-muted-foreground">更新角色</div>
                  </div>
                )}
                <div>
                  <div className="text-2xl font-bold text-green-500">{importResult.newStyles}</div>
                  <div className="text-muted-foreground">新增造型</div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                正在跳转到角色管理页面...
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

