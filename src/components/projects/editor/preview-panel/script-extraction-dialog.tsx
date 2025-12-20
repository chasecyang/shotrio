"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, X, User, MapPin, Box, Shirt, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { ScriptElementExtractionResult } from "@/types/job";

interface ScriptExtractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extractionResult: ScriptElementExtractionResult | null;
  isLoading?: boolean;
  onConfirm: (elements: ScriptElementExtractionResult["elements"]) => Promise<void>;
}

type ElementType = "character" | "scene" | "prop" | "costume" | "effect";

const TYPE_CONFIG: Record<ElementType, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  character: { label: "角色", icon: User, color: "text-blue-500" },
  scene: { label: "场景", icon: MapPin, color: "text-green-500" },
  prop: { label: "道具", icon: Box, color: "text-purple-500" },
  costume: { label: "服装", icon: Shirt, color: "text-pink-500" },
  effect: { label: "特效", icon: Sparkles, color: "text-orange-500" },
};

export function ScriptExtractionDialog({
  open,
  onOpenChange,
  extractionResult,
  isLoading,
  onConfirm,
}: ScriptExtractionDialogProps) {
  // 本地编辑状态
  const [elements, setElements] = useState<ScriptElementExtractionResult["elements"]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<ElementType>("character");

  // 同步提取结果
  useMemo(() => {
    if (extractionResult) {
      setElements(extractionResult.elements);
      // 默认全选
      setSelectedIds(new Set(extractionResult.elements.map(el => el.id)));
    }
  }, [extractionResult]);

  // 按类型分组
  const elementsByType = useMemo(() => {
    return {
      character: elements.filter(el => el.type === "character"),
      scene: elements.filter(el => el.type === "scene"),
      prop: elements.filter(el => el.type === "prop"),
      costume: elements.filter(el => el.type === "costume"),
      effect: elements.filter(el => el.type === "effect"),
    };
  }, [elements]);

  // 统计信息
  const stats = useMemo(() => {
    const totalCount = elements.length;
    const selectedCount = selectedIds.size;
    const toGenerateCount = elements.filter(el => selectedIds.has(el.id)).length;
    
    return {
      totalCount,
      selectedCount,
      toGenerateCount,
      noGenerateCount: totalCount - toGenerateCount,
    };
  }, [elements, selectedIds]);

  // 切换选中
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 全选/取消全选当前类型
  const toggleSelectAllType = (type: ElementType) => {
    const typeElements = elementsByType[type];
    const allSelected = typeElements.every(el => selectedIds.has(el.id));
    
    setSelectedIds(prev => {
      const next = new Set(prev);
      typeElements.forEach(el => {
        if (allSelected) {
          next.delete(el.id);
        } else {
          next.add(el.id);
        }
      });
      return next;
    });
  };

  // 删除元素
  const removeElement = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // 更新元素
  const updateElement = (id: string, updates: Partial<ScriptElementExtractionResult["elements"][0]>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  // 确认提取
  const handleConfirm = async () => {
    if (elements.length === 0) {
      toast.error("没有可提取的元素");
      return;
    }

    setIsSubmitting(true);
    try {
      // 标记哪些需要生成图片
      const elementsWithGenFlag = elements.map(el => ({
        ...el,
        shouldGenerate: selectedIds.has(el.id),
      }));

      await onConfirm(elementsWithGenFlag);
      
      toast.success(
        `已创建 ${elements.length} 个素材${stats.toGenerateCount > 0 ? `，其中 ${stats.toGenerateCount} 个正在生成图片` : ""}`
      );
      onOpenChange(false);
    } catch (error) {
      console.error("提取失败:", error);
      toast.error("提取失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>剧本元素提取</span>
            <div className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
              <Badge variant="secondary">
                共 {stats.totalCount} 个元素
              </Badge>
              <Badge variant="default">
                已选 {stats.selectedCount} 个生成
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">AI正在分析剧本...</p>
            </div>
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ElementType)} className="flex-1 flex flex-col min-h-0">
              <div className="px-6 shrink-0">
                <TabsList className="w-full grid grid-cols-5">
                  {(Object.keys(TYPE_CONFIG) as ElementType[]).map(type => {
                    const config = TYPE_CONFIG[type];
                    const count = elementsByType[type].length;
                    const Icon = config.icon;
                    
                    return (
                      <TabsTrigger key={type} value={type} className="gap-1.5">
                        <Icon className={`w-4 h-4 ${config.color}`} />
                        <span>{config.label}</span>
                        {count > 0 && (
                          <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                            {count}
                          </Badge>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {(Object.keys(TYPE_CONFIG) as ElementType[]).map(type => (
                <TabsContent key={type} value={type} className="flex-1 mt-0 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-6 space-y-4">
                      {/* 操作栏 */}
                      <div className="flex items-center justify-between">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleSelectAllType(type)}
                        >
                          {elementsByType[type].every(el => selectedIds.has(el.id))
                            ? "取消全选"
                            : "全选生成"}
                        </Button>
                        <p className="text-sm text-muted-foreground">
                          勾选的元素将生成图片，未勾选的仅创建提示词记录
                        </p>
                      </div>

                      {/* 元素卡片网格 */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {elementsByType[type].map(element => {
                          const isSelected = selectedIds.has(element.id);
                          const Icon = TYPE_CONFIG[element.type].icon;
                          
                          return (
                            <Card
                              key={element.id}
                              className={`transition-all ${
                                isSelected ? "border-primary shadow-sm" : ""
                              }`}
                            >
                              <CardContent className="p-4 space-y-3">
                                {/* 头部 */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => toggleSelect(element.id)}
                                    />
                                    <Icon className={`w-4 h-4 shrink-0 ${TYPE_CONFIG[element.type].color}`} />
                                    <Input
                                      value={element.name}
                                      onChange={(e) => updateElement(element.id, { name: e.target.value })}
                                      className="h-8 font-medium"
                                    />
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() => removeElement(element.id)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>

                                {/* 描述 */}
                                <div className="space-y-1">
                                  <label className="text-xs text-muted-foreground">描述</label>
                                  <Textarea
                                    value={element.description}
                                    onChange={(e) => updateElement(element.id, { description: e.target.value })}
                                    className="min-h-[60px] text-sm resize-none"
                                  />
                                </div>

                                {/* Prompt */}
                                <div className="space-y-1">
                                  <label className="text-xs text-muted-foreground">AI提示词</label>
                                  <Textarea
                                    value={element.prompt}
                                    onChange={(e) => updateElement(element.id, { prompt: e.target.value })}
                                    className="min-h-[80px] text-xs font-mono resize-none"
                                  />
                                </div>

                                {/* 标签 */}
                                <div className="flex flex-wrap gap-1">
                                  {element.tags.map((tag, i) => (
                                    <Badge key={i} variant={i === 0 ? "default" : "secondary"}>
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>

                                {/* 额外信息 */}
                                {(element.appearance || element.context) && (
                                  <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                                    {element.appearance && (
                                      <p><strong>外貌:</strong> {element.appearance}</p>
                                    )}
                                    {element.context && (
                                      <p><strong>备注:</strong> {element.context}</p>
                                    )}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>

                      {/* 空状态 */}
                      {elementsByType[type].length === 0 && (
                        <div className="py-12 text-center text-muted-foreground">
                          <p>暂无{TYPE_CONFIG[type].label}元素</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>

            {/* 底部操作栏 */}
            <div className="px-6 py-4 border-t shrink-0 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                将创建 <strong>{stats.totalCount}</strong> 个素材，
                其中 <strong className="text-primary">{stats.toGenerateCount}</strong> 个生成图片，
                <strong>{stats.noGenerateCount}</strong> 个仅保留提示词
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button onClick={handleConfirm} disabled={isSubmitting || elements.length === 0}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  确认提取
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

