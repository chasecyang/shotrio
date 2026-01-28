"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AlertCircle, Coins, Check, X, ArrowLeft, Loader2, ChevronDown, Image, Video, FileText } from "lucide-react";
import { useEditor, type FunctionCallData } from "./editor-context";
import { ImageGenerationForm, VideoGenerationForm, TextAssetForm } from "./agent-panel/action-editor-forms";
import { PurchaseDialog } from "@/components/credits/purchase-dialog";
import { getArtStyleById } from "@/lib/actions/art-style/queries";
import { estimateActionCredits } from "@/lib/actions/credits/estimate";
import type { FunctionCall } from "@/types/agent";
import type { CreditCost } from "@/lib/utils/credit-calculator";
import { cn } from "@/lib/utils";

export function ActionEditorPanel() {
  const t = useTranslations();
  const { state, clearActionEditor } = useEditor();
  const { actionEditor } = state;

  // 判断是否为批量模式
  const isBatchMode = actionEditor?.functionCalls && actionEditor.functionCalls.length > 1;
  const allFunctionCalls = useMemo(() => {
    if (!actionEditor) return [];
    if (isBatchMode && actionEditor.functionCalls) {
      return actionEditor.functionCalls;
    }
    return [actionEditor.functionCall];
  }, [actionEditor, isBatchMode]);

  // 批量模式下被禁用的 tool call IDs
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());

  // 本地编辑状态 - 使用 Map 存储每个 function call 的编辑参数
  const [editedParamsMap, setEditedParamsMap] = useState<Map<string, Record<string, unknown>>>(() => {
    const map = new Map<string, Record<string, unknown>>();
    allFunctionCalls.forEach(fc => {
      map.set(fc.id, { ...fc.arguments });
    });
    return map;
  });

  // 当 actionEditor 变化时重置编辑状态
  useEffect(() => {
    if (!actionEditor) return;
    const map = new Map<string, Record<string, unknown>>();
    allFunctionCalls.forEach(fc => {
      map.set(fc.id, { ...fc.arguments });
    });
    setEditedParamsMap(map);
    setDisabledIds(new Set()); // 重置禁用状态
    // 默认展开第一个卡片
    if (allFunctionCalls.length > 0) {
      setExpandedIds(new Set([allFunctionCalls[0].id]));
    }
  }, [actionEditor?.functionCall.id]);

  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [artStyleName, setArtStyleName] = useState<string | null>(null);
  const [dynamicCreditCost, setDynamicCreditCost] = useState<CreditCost | undefined>(
    actionEditor?.creditCost
  );

  // 如果没有 actionEditor 数据，不渲染
  if (!actionEditor) {
    return null;
  }

  const { functionCall, currentBalance, onConfirm, onCancel, onBatchConfirm } = actionEditor;

  // 计算启用的 function calls（排除被禁用的）
  const enabledFunctionCalls = useMemo(() => {
    return allFunctionCalls.filter(fc => !disabledIds.has(fc.id));
  }, [allFunctionCalls, disabledIds]);

  // 切换某个 tool call 的启用/禁用状态
  const toggleEnabled = (fcId: string) => {
    setDisabledIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fcId)) {
        newSet.delete(fcId);
      } else {
        // 不允许禁用所有项
        if (newSet.size < allFunctionCalls.length - 1) {
          newSet.add(fcId);
        }
      }
      return newSet;
    });
  };

  const totalCost = dynamicCreditCost?.total || 0;
  const insufficientBalance = currentBalance !== undefined && totalCost > currentBalance;

  // 获取当前编辑的参数（单个模式向后兼容）
  const currentEditedParams = editedParamsMap.get(functionCall.id) || functionCall.arguments;

  // 更新单个 function call 的参数
  const updateParams = (fcId: string, params: Record<string, unknown>) => {
    setEditedParamsMap(prev => {
      const newMap = new Map(prev);
      newMap.set(fcId, params);
      return newMap;
    });
  };

  // 监听参数变化，重新计算积分（只计算启用的 function calls）
  useEffect(() => {
    if (!actionEditor) return;

    let isActive = true;
    const recalculateCredits = async () => {
      try {
        // 只计算启用的 function calls
        const functionCallsForEstimate: FunctionCall[] = enabledFunctionCalls.map(fc => ({
          id: fc.id,
          name: fc.name,
          displayName: fc.displayName,
          parameters: editedParamsMap.get(fc.id) || fc.arguments,
          category: fc.category as FunctionCall["category"],
          needsConfirmation: true,
        }));

        const result = await estimateActionCredits(functionCallsForEstimate);
        if (isActive && result.success && result.creditCost) {
          setDynamicCreditCost(result.creditCost);
        }
      } catch (error) {
        console.error("重新计算积分失败:", error);
      }
    };

    recalculateCredits();

    return () => {
      isActive = false;
    };
  }, [editedParamsMap, enabledFunctionCalls, actionEditor]);

  // 判断操作类型（使用第一个 function call）
  const isGenerateAssets = functionCall.name === "generate_image_asset";
  const isGenerateVideo = functionCall.name === "generate_video_asset";
  const isCreateTextAsset = functionCall.name === "create_text_asset";
  const isSetProjectInfo = functionCall.name === "set_project_info";

  // 批量模式下检测是否有混合类型
  const batchTypeInfo = useMemo(() => {
    if (!isBatchMode) return null;
    const types = new Set(allFunctionCalls.map(fc => fc.name));
    const isMixed = types.size > 1;
    const counts = {
      video: allFunctionCalls.filter(fc => fc.name === "generate_video_asset").length,
      image: allFunctionCalls.filter(fc => fc.name === "generate_image_asset").length,
      text: allFunctionCalls.filter(fc => fc.name === "create_text_asset").length,
    };
    return { isMixed, types, counts };
  }, [isBatchMode, allFunctionCalls]);

  // 获取美术风格名称（仅当 set_project_info 使用 styleId 时）
  useEffect(() => {
    if (!isSetProjectInfo) {
      setArtStyleName(null);
      return;
    }

    const stylePrompt = functionCall.arguments.stylePrompt as string | undefined;
    if (stylePrompt && stylePrompt.trim()) {
      setArtStyleName(null);
      return;
    }

    const styleId = functionCall.arguments.styleId as string;
    if (!styleId) {
      setArtStyleName(null);
      return;
    }

    // 异步获取美术风格名称
    let isActive = true;
    getArtStyleById(styleId).then((style) => {
      if (isActive) {
        setArtStyleName(style ? style.name : null);
      }
    }).catch((error) => {
      if (isActive) {
        console.error("获取美术风格名称失败:", error);
      }
    });

    return () => {
      isActive = false;
    };
  }, [isSetProjectInfo, functionCall.arguments.styleId, functionCall.arguments.stylePrompt]);

  // 获取标题
  const getTitle = () => {
    // 批量模式下检测混合类型
    if (isBatchMode && batchTypeInfo) {
      if (batchTypeInfo.isMixed) {
        // 混合类型：显示通用标题
        return t('actionEditorPanel.batchActions', { count: allFunctionCalls.length });
      }
      // 单一类型批量
      let baseTitle = "";
      if (isGenerateVideo) baseTitle = t('actionEditorPanel.generateVideo');
      else if (isGenerateAssets) baseTitle = t('actionEditorPanel.generateImage');
      else if (isCreateTextAsset) baseTitle = t('actionEditorPanel.createTextAsset');
      else baseTitle = functionCall.displayName || functionCall.name;
      return `${baseTitle} (${allFunctionCalls.length})`;
    }

    // 单个模式
    let baseTitle = "";
    if (isGenerateAssets) baseTitle = t('actionEditorPanel.generateImage');
    else if (isGenerateVideo) baseTitle = t('actionEditorPanel.generateVideo');
    else if (isCreateTextAsset) baseTitle = t('actionEditorPanel.createTextAsset');
    else if (isSetProjectInfo) {
      const args = functionCall.arguments as {
        title?: string;
        description?: string;
        stylePrompt?: string;
        styleId?: string;
      };
      const fields: string[] = [];
      if (args.title) fields.push(t('actionEditorPanel.setProjectTitle'));
      if (args.description) fields.push(t('actionEditorPanel.setProjectDescription'));
      if (args.stylePrompt) {
        fields.push(t('actionEditorPanel.setProjectArtStyle'));
      } else if (args.styleId) {
        fields.push(artStyleName ? `${t('actionEditorPanel.setProjectArtStyle')}(${artStyleName})` : t('actionEditorPanel.setProjectArtStyle'));
      }
      baseTitle = fields.length > 0 ? `${t('actionEditorPanel.setProject')}${fields.join("、")}` : t('actionEditorPanel.setProjectInfo');
    } else {
      baseTitle = functionCall.displayName || functionCall.name;
    }
    return baseTitle;
  };

  // 获取描述
  const getDescription = () => {
    // 批量模式下检测混合类型
    if (isBatchMode && batchTypeInfo) {
      if (batchTypeInfo.isMixed) {
        // 混合类型：显示各类型数量
        const parts: string[] = [];
        if (batchTypeInfo.counts.video > 0) {
          parts.push(`${batchTypeInfo.counts.video} ${t('actionEditorPanel.video')}`);
        }
        if (batchTypeInfo.counts.image > 0) {
          parts.push(`${batchTypeInfo.counts.image} ${t('actionEditorPanel.image')}`);
        }
        if (batchTypeInfo.counts.text > 0) {
          parts.push(`${batchTypeInfo.counts.text} ${t('actionEditorPanel.text')}`);
        }
        return parts.join(" · ");
      }
      // 单一类型批量
      if (isGenerateVideo) {
        return t('actionEditorPanel.generateVideoBatchDesc', { count: allFunctionCalls.length });
      }
    }

    if (isGenerateAssets) return t('actionEditorPanel.generateImageDesc');
    if (isGenerateVideo) return t('actionEditorPanel.generateVideoDesc');
    if (isCreateTextAsset) return t('actionEditorPanel.createTextAssetDesc');
    return t('actionEditorPanel.defaultDesc');
  };

  // 处理确认（只执行启用的 tool calls）
  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      // 先清除编辑器界面，让用户立即看到响应
      clearActionEditor();

      if (isBatchMode && onBatchConfirm) {
        // 批量模式：只传递启用的 tool calls 的参数
        const enabledParamsMap = new Map<string, Record<string, unknown>>();
        for (const fc of enabledFunctionCalls) {
          enabledParamsMap.set(fc.id, editedParamsMap.get(fc.id) || fc.arguments);
        }
        // 同时传递被禁用的 IDs，让后端知道哪些需要跳过
        await onBatchConfirm(enabledParamsMap, disabledIds);
      } else {
        // 单个模式
        await onConfirm(functionCall.id, editedParamsMap.get(functionCall.id));
      }
    } catch (error) {
      console.error("确认操作失败:", error);
    } finally {
      setIsConfirming(false);
    }
  };

  // 处理取消
  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      // 先清除编辑器界面，让用户立即看到响应
      clearActionEditor();
      // 然后在后台执行取消操作
      await onCancel(functionCall.id);
    } catch (error) {
      console.error("取消操作失败:", error);
    } finally {
      setIsCancelling(false);
    }
  };

  // 处理关闭（不执行操作，直接返回）
  const handleClose = () => {
    clearActionEditor();
  };

  // 渲染单个表单
  const renderForm = (fc: FunctionCallData, params: Record<string, unknown>, onChange: (p: Record<string, unknown>) => void) => {
    if (fc.name === "generate_image_asset") {
      return <ImageGenerationForm params={params} onChange={onChange} />;
    }
    if (fc.name === "generate_video_asset") {
      return <VideoGenerationForm params={params} onChange={onChange} />;
    }
    if (fc.name === "create_text_asset") {
      return <TextAssetForm params={params} onChange={onChange} />;
    }
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('actionEditorPanel.noEditableParams')}</p>
      </div>
    );
  };

  // 批量模式下展开的卡片 IDs
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // 默认展开第一个
    if (allFunctionCalls.length > 0) {
      return new Set([allFunctionCalls[0].id]);
    }
    return new Set();
  });

  // 切换卡片展开状态
  const toggleExpanded = (fcId: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fcId)) {
        newSet.delete(fcId);
      } else {
        newSet.add(fcId);
      }
      return newSet;
    });
  };

  // 获取类型图标
  const getTypeIcon = (fcName: string) => {
    if (fcName === "generate_video_asset") return Video;
    if (fcName === "generate_image_asset") return Image;
    if (fcName === "create_text_asset") return FileText;
    return FileText;
  };

  // 获取卡片标题
  const getCardTitle = (fc: FunctionCallData) => {
    const args = fc.arguments as { title?: string; prompt?: string; name?: string };
    return args.title || args.name ||
      (args.prompt ? args.prompt.slice(0, 30) + (args.prompt.length > 30 ? "..." : "") : t('common.unnamed'));
  };

  const isLoading = isConfirming || isCancelling;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold">{getTitle()}</h2>
              <p className="text-sm text-muted-foreground">{getDescription()}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            disabled={isLoading}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-6 max-w-4xl mx-auto">
          {isBatchMode ? (
            /* 批量编辑：使用卡片列表 */
            <div className="space-y-3">
              {/* 卡片列表 */}
              {allFunctionCalls.map((fc, index) => {
                const isDisabled = disabledIds.has(fc.id);
                const isExpanded = expandedIds.has(fc.id);
                const TypeIcon = getTypeIcon(fc.name);
                const cardTitle = getCardTitle(fc);

                return (
                  <Collapsible
                    key={fc.id}
                    open={isExpanded}
                    onOpenChange={() => toggleExpanded(fc.id)}
                  >
                    <div
                      className={cn(
                        "rounded-lg border transition-all",
                        isDisabled
                          ? "bg-muted/30 border-border/50"
                          : "bg-card border-border hover:border-primary/30"
                      )}
                    >
                      {/* 卡片头部 */}
                      <div className="flex items-center gap-3 p-3">
                        <Checkbox
                          checked={!isDisabled}
                          onCheckedChange={() => toggleEnabled(fc.id)}
                          disabled={!isDisabled && enabledFunctionCalls.length <= 1}
                          className="shrink-0"
                        />
                        <CollapsibleTrigger asChild>
                          <button
                            className={cn(
                              "flex-1 flex items-center gap-3 text-left min-w-0",
                              "hover:opacity-80 transition-opacity"
                            )}
                          >
                            <div
                              className={cn(
                                "shrink-0 w-8 h-8 rounded-md flex items-center justify-center",
                                isDisabled
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-primary/10 text-primary"
                              )}
                            >
                              <TypeIcon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div
                                className={cn(
                                  "text-sm font-medium truncate",
                                  isDisabled && "text-muted-foreground"
                                )}
                              >
                                {cardTitle}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {fc.name === "generate_video_asset"
                                  ? t('actionEditorPanel.video')
                                  : fc.name === "generate_image_asset"
                                    ? t('actionEditorPanel.image')
                                    : t('actionEditorPanel.text')}
                                {" · "}#{index + 1}
                              </div>
                            </div>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </button>
                        </CollapsibleTrigger>
                      </div>

                      {/* 卡片内容 */}
                      <CollapsibleContent>
                        <div
                          className={cn(
                            "px-3 pb-4 pt-1 border-t border-border/50",
                            isDisabled && "opacity-50 pointer-events-none"
                          )}
                        >
                          {renderForm(
                            fc,
                            editedParamsMap.get(fc.id) || fc.arguments,
                            (params) => updateParams(fc.id, params)
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          ) : (
            /* 单个模式 */
            <>
              {isGenerateAssets && (
                <ImageGenerationForm
                  params={currentEditedParams}
                  onChange={(params) => updateParams(functionCall.id, params)}
                />
              )}
              {isGenerateVideo && (
                <VideoGenerationForm
                  params={currentEditedParams}
                  onChange={(params) => updateParams(functionCall.id, params)}
                />
              )}
              {isCreateTextAsset && (
                <TextAssetForm
                  params={currentEditedParams}
                  onChange={(params) => updateParams(functionCall.id, params)}
                />
              )}
              {!isGenerateAssets && !isGenerateVideo && !isCreateTextAsset && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">{t('actionEditorPanel.noEditableParams')}</p>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex-shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between p-4">
          {/* Credit Cost */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted border border-border">
              <Coins className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">{totalCost}</span>
              <span className="text-xs text-muted-foreground">{t('actionEditorPanel.credits')}</span>
            </div>
            {/* 批量模式显示启用/禁用数量 */}
            {isBatchMode && disabledIds.size > 0 && (
              <span className="text-xs text-muted-foreground">
                {t('actionEditorPanel.enabledCount', {
                  enabled: enabledFunctionCalls.length,
                  total: allFunctionCalls.length
                })}
              </span>
            )}
            {insufficientBalance && (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{t('actionEditorPanel.insufficientBalance', { balance: currentBalance })}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('actionEditorPanel.processing')}
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  {t('editor.agent.pendingAction.reject')}
                </>
              )}
            </Button>
            <Button
              onClick={() => {
                if (insufficientBalance) {
                  setShowPurchaseDialog(true);
                } else {
                  handleConfirm();
                }
              }}
              disabled={isLoading}
            >
              {isConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('actionEditorPanel.executing')}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {t('editor.agent.pendingAction.confirm')}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Purchase Dialog */}
      <PurchaseDialog
        open={showPurchaseDialog}
        onOpenChange={setShowPurchaseDialog}
      />
    </div>
  );
}

