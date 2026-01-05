"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Coins, Check, X, ArrowLeft, Plus, Loader2 } from "lucide-react";
import { useEditor } from "./editor-context";
import { ImageGenerationForm, VideoGenerationForm, TextAssetForm } from "./agent-panel/action-editor-forms";
import { PurchaseDialog } from "@/components/credits/purchase-dialog";
import { getArtStyleById } from "@/lib/actions/art-style/queries";

export function ActionEditorPanel() {
  const t = useTranslations();
  const { state, clearActionEditor } = useEditor();
  const { actionEditor } = state;

  // 本地编辑状态
  const [editedParams, setEditedParams] = useState<Record<string, unknown>>(
    actionEditor?.functionCall.arguments || {}
  );
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [artStyleName, setArtStyleName] = useState<string | null>(null);

  // 如果没有 actionEditor 数据，不渲染
  if (!actionEditor) {
    return null;
  }

  const { functionCall, creditCost, currentBalance, onConfirm, onCancel } = actionEditor;
  const totalCost = creditCost?.total || 0;
  const insufficientBalance = currentBalance !== undefined && totalCost > currentBalance;

  // 判断操作类型
  const isGenerateAssets = functionCall.name === "generate_image_asset";
  const isGenerateVideo = functionCall.name === "generate_video_asset";
  const isCreateTextAsset = functionCall.name === "create_text_asset";
  const isSetArtStyle = functionCall.name === "set_art_style";

  // 获取美术风格名称
  useEffect(() => {
    if (!isSetArtStyle) return;
    
    const styleId = functionCall.arguments.styleId as string;
    if (!styleId) return;

    // 异步获取美术风格名称
    getArtStyleById(styleId).then((style) => {
      if (style) {
        setArtStyleName(style.name);
      }
    }).catch((error) => {
      console.error("获取美术风格名称失败:", error);
    });
  }, [isSetArtStyle, functionCall.arguments.styleId]);

  // 获取标题
  const getTitle = () => {
    if (isGenerateAssets) return "生成图片素材";
    if (isGenerateVideo) return "生成视频素材";
    if (isCreateTextAsset) return "创建文本资产";
    if (isSetArtStyle && artStyleName) return `设置美术风格 - ${artStyleName}`;
    return functionCall.displayName || functionCall.name;
  };

  // 获取描述
  const getDescription = () => {
    if (isGenerateAssets) return "检查并修改图片生成参数，确认后将使用AI生成图片素材";
    if (isGenerateVideo) return "检查并修改视频生成参数，确认后将使用AI生成视频素材";
    if (isCreateTextAsset) return "检查并修改文本资产的内容和标签信息";
    return "检查参数并确认执行";
  };

  // 处理确认
  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm(functionCall.id, editedParams);
      // 确认后自动返回之前的视图
      clearActionEditor();
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
      await onCancel(functionCall.id);
      // 取消后自动返回之前的视图
      clearActionEditor();
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
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl mx-auto">
          {isGenerateAssets && (
            <ImageGenerationForm
              params={editedParams}
              onChange={setEditedParams}
            />
          )}
          {isGenerateVideo && (
            <VideoGenerationForm
              params={editedParams}
              onChange={setEditedParams}
            />
          )}
          {isCreateTextAsset && (
            <TextAssetForm
              params={editedParams}
              onChange={setEditedParams}
            />
          )}
          {!isGenerateAssets && !isGenerateVideo && !isCreateTextAsset && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">此操作暂无可编辑参数</p>
            </div>
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
              <span className="text-xs text-muted-foreground">积分</span>
            </div>
            {insufficientBalance && (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">余额不足 ({currentBalance})</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={() => setShowPurchaseDialog(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  充值
                </Button>
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
                  处理中...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  {t('editor.agent.pendingAction.reject')}
                </>
              )}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={insufficientBalance || isLoading}
            >
              {isConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  执行中...
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


