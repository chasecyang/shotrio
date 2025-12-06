"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Users, CheckCircle2, AlertCircle, ChevronRight, Pencil, Trash2, Plus } from "lucide-react";
import { extractCharactersFromScript, importExtractedCharacters } from "@/lib/actions/character-actions";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { ExtractedCharacter, ExtractedCharacterStyle } from "@/types/project";
import { useRouter } from "next/navigation";

interface CharacterExtractionDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCharacters?: Array<{ id: string; name: string }>;
}

type Step = "extracting" | "preview" | "importing" | "success";

export function CharacterExtractionDialog({
  projectId,
  open,
  onOpenChange,
  existingCharacters = [],
}: CharacterExtractionDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("extracting");
  const [extractedCharacters, setExtractedCharacters] = useState<ExtractedCharacter[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<Set<number>>(new Set());
  const [selectedCharIndex, setSelectedCharIndex] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [importResult, setImportResult] = useState<{
    newCharacters: number;
    newStyles: number;
    updatedCharacters: number;
  } | null>(null);

  // 开始提取
  useEffect(() => {
    if (open && step === "extracting") {
      handleExtraction();
    }
  }, [open, step]);

  const handleExtraction = async () => {
    try {
      setError("");
      const result = await extractCharactersFromScript(projectId);

      if (!result.success || !result.data) {
        setError(result.error || "提取失败");
        return;
      }

      // 标记已存在的角色
      const existingNames = new Set(
        existingCharacters.map(c => c.name.toLowerCase().trim())
      );

      const charactersWithStatus = result.data.characters.map(char => {
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
      setError(err instanceof Error ? err.message : "提取失败");
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
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        {step === "extracting" && (
          <div className="p-12">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-2xl flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                </div>
                正在提取角色信息
              </DialogTitle>
            </DialogHeader>

            {error ? (
              <div className="space-y-6">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-destructive mb-1">提取失败</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => setStep("extracting")} className="flex-1">
                    <Sparkles className="w-4 h-4 mr-2" />
                    重试
                  </Button>
                  <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-center">
                  <Loader2 className="w-16 h-16 text-primary animate-spin" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">AI 正在分析剧本内容...</p>
                  <p className="text-sm text-muted-foreground">
                    正在识别角色、提取外貌特征和造型描述
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "preview" && (
          <>
            <DialogHeader className="p-6 pb-4 border-b">
              <DialogTitle className="text-xl flex items-center gap-2">
                <Users className="w-5 h-5" />
                预览并编辑角色信息
                <Badge variant="secondary" className="ml-2">
                  共提取 {extractedCharacters.length} 个角色
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-1 min-h-0">
              {/* 左侧角色列表 */}
              <div className="w-80 border-r flex flex-col">
                <div className="p-4 border-b">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleAll}
                    className="w-full"
                  >
                    {selectedCharacters.size === extractedCharacters.length ? "取消全选" : "全选"}
                  </Button>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-2">
                    {extractedCharacters.map((char, index) => (
                      <Card
                        key={index}
                        className={`p-3 cursor-pointer transition-all ${
                          selectedCharIndex === index
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/50"
                        }`}
                        onClick={() => setSelectedCharIndex(index)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedCharacters.has(index)}
                            onCheckedChange={() => toggleCharacter(index)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium truncate">{char.name}</h4>
                              {char.isExisting ? (
                                <Badge variant="secondary" className="text-xs">
                                  已存在
                                </Badge>
                              ) : (
                                <Badge className="text-xs bg-green-500">
                                  新角色
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {char.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {char.styles.length} 个造型
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* 右侧详情编辑 */}
              <div className="flex-1 flex flex-col min-w-0">
                <ScrollArea className="flex-1">
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
                        <div className="space-y-4">
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
            </div>

            {/* 底部操作栏 */}
            <div className="p-4 border-t bg-muted/30">
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

