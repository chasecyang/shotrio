"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  Plus,
  X,
  Loader2,
  ImageIcon,
  Coins,
} from "lucide-react";
import { editAssetImageAsVersion } from "@/lib/actions/asset/generate-asset";
import type { AssetWithFullData, ImageResolution } from "@/types/asset";
import type { AspectRatio } from "@/lib/services/image.service";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { AssetLibraryPickerDialog } from "./asset-library-picker-dialog";
import { getAssetsByIds } from "@/lib/actions/asset";
import { AspectRatioSelector } from "./aspect-ratio-selector";
import { ResolutionSelector } from "./resolution-selector";
import { CREDIT_COSTS } from "@/types/payment";
import { hasEnoughCredits } from "@/lib/actions/credits/balance";
import { PurchaseDialog } from "@/components/credits/purchase-dialog";

interface AssetEditModeProps {
  asset: AssetWithFullData;
  projectId: string;
  onBack: () => void;
  onSuccess: () => void;
  mode?: "edit" | "regenerate";
}

// 解析 generationConfig
function parseGenerationConfig(config: string | null): {
  aspectRatio: AspectRatio | "auto";
  resolution: ImageResolution;
} {
  if (!config) {
    return { aspectRatio: "auto", resolution: "2K" };
  }
  try {
    const parsed = JSON.parse(config);
    return {
      aspectRatio: parsed.aspectRatio || "auto",
      resolution: parsed.resolution || "2K",
    };
  } catch {
    return { aspectRatio: "auto", resolution: "2K" };
  }
}

export function AssetEditMode({
  asset,
  projectId,
  onBack,
  onSuccess,
  mode = "edit",
}: AssetEditModeProps) {
  const t = useTranslations("editor.assetEdit");
  const tCredits = useTranslations("credits");
  const tCommon = useTranslations("common");

  const isRegenerate = mode === "regenerate";

  // 解析原始生成参数（仅 regenerate 模式使用）
  const originalConfig = useMemo(
    () => (isRegenerate ? parseGenerationConfig(asset.generationConfig) : null),
    [isRegenerate, asset.generationConfig]
  );

  // 表单状态 - 根据 mode 决定初始值
  const [editPrompt, setEditPrompt] = useState(
    isRegenerate ? asset.prompt || "" : ""
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio | "auto">(
    originalConfig?.aspectRatio ?? "auto"
  );
  const [resolution, setResolution] = useState<ImageResolution>(
    originalConfig?.resolution ?? "2K"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 参考图选择
  const [referenceAssetIds, setReferenceAssetIds] = useState<string[]>([]);
  const [referenceAssets, setReferenceAssets] = useState<Array<{
    id: string;
    name: string;
    displayUrl: string | null;
  }>>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isLoadingReferences, setIsLoadingReferences] = useState(isRegenerate);

  // 积分相关状态
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const requiredCredits = CREDIT_COSTS.IMAGE_GENERATION;

  // 加载参考图详情
  const loadReferenceAssets = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setReferenceAssets([]);
      return;
    }
    const result = await getAssetsByIds(ids);
    if (result.success && result.assets) {
      setReferenceAssets(result.assets);
    }
  }, []);

  // regenerate 模式：初始化加载原始参考图
  useEffect(() => {
    if (!isRegenerate) return;

    const initReferenceAssets = async () => {
      setIsLoadingReferences(true);
      // 过滤掉当前素材自身
      const originalIds = (asset.sourceAssetIds || []).filter(id => id !== asset.id);
      setReferenceAssetIds(originalIds);
      await loadReferenceAssets(originalIds);
      setIsLoadingReferences(false);
    };
    initReferenceAssets();
  }, [isRegenerate, asset.id, asset.sourceAssetIds, loadReferenceAssets]);

  // 处理参考图选择确认
  const handleReferenceConfirm = useCallback(async (ids: string[]) => {
    // 过滤掉原素材本身
    const filteredIds = ids.filter(id => id !== asset.id);
    setReferenceAssetIds(filteredIds);
    await loadReferenceAssets(filteredIds);
  }, [asset.id, loadReferenceAssets]);

  // 移除参考图
  const removeReferenceAsset = useCallback((idToRemove: string) => {
    const newIds = referenceAssetIds.filter(id => id !== idToRemove);
    setReferenceAssetIds(newIds);
    setReferenceAssets(prev => prev.filter(a => a.id !== idToRemove));
  }, [referenceAssetIds]);

  // 提交编辑
  const handleSubmit = async () => {
    if (!editPrompt.trim()) {
      toast.error(t("promptRequired"));
      return;
    }

    // 检查积分是否充足
    const creditCheck = await hasEnoughCredits(requiredCredits);
    if (!creditCheck.success || !creditCheck.hasEnough) {
      toast.error(tCredits("insufficientTitle"));
      setPurchaseDialogOpen(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await editAssetImageAsVersion({
        assetId: asset.id,
        editPrompt: editPrompt.trim(),
        sourceAssetIds: referenceAssetIds,
        aspectRatio,
        resolution,
      });

      if (result.success) {
        toast.success(isRegenerate ? t("regenerateSuccess") : t("submitSuccess"));
        // 触发素材刷新事件
        window.dispatchEvent(new CustomEvent("asset-created"));
        window.dispatchEvent(new CustomEvent("credits-changed"));
        onSuccess();
        onBack();
      } else {
        toast.error(result.error || t("submitFailed"));
      }
    } catch (error) {
      console.error("Edit asset failed:", error);
      toast.error(t("submitFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-semibold">
          {isRegenerate ? t("regenerateTitle") : t("title")}
        </h2>
        <Badge variant="secondary" className="ml-auto text-xs">
          {asset.name}
        </Badge>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-xl mx-auto space-y-6">
          {/* 参考图片 - 移到上方并放大 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("referenceImages")}</Label>
              <span className="text-[10px] text-muted-foreground">
                {t("optional")}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {isLoadingReferences ? (
                <div className="w-24 h-24 rounded-xl border border-border/50 bg-muted/20 animate-pulse" />
              ) : (
                referenceAssets.map((refAsset) => (
                  <div
                    key={refAsset.id}
                    className="relative group w-24 h-24 rounded-xl overflow-hidden border border-border/50 bg-muted/20 shadow-sm transition-shadow hover:shadow-md"
                  >
                    {refAsset.displayUrl ? (
                      <Image
                        src={refAsset.displayUrl}
                        alt={refAsset.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}
                    <button
                      onClick={() => removeReferenceAsset(refAsset.id)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
              <button
                onClick={() => setPickerOpen(true)}
                className={cn(
                  "w-24 h-24 rounded-xl border-2 border-dashed border-border/60",
                  "flex items-center justify-center",
                  "text-muted-foreground/60 hover:text-muted-foreground hover:border-border hover:bg-muted/30",
                  "transition-all"
                )}
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Prompt 输入 */}
          <div className="space-y-2">
            <Label htmlFor="edit-prompt" className="text-xs">{t("promptLabel")}</Label>
            <Textarea
              id="edit-prompt"
              placeholder={t("promptPlaceholder")}
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              className="min-h-[100px] resize-none text-sm"
            />
          </div>

          {/* 生成参数 */}
          <div className="space-y-3.5 pt-1 mt-5 border-t border-border/50">
            <div className="space-y-2">
              <Label className="text-xs">{t("aspectRatio")}</Label>
              <AspectRatioSelector
                value={aspectRatio}
                onChange={setAspectRatio}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("resolution")}</Label>
              <ResolutionSelector
                value={resolution}
                onChange={setResolution}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 border-t flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={isSubmitting}>
          {tCommon("cancel")}
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!editPrompt.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {isRegenerate ? t("regenerateSubmitting") : t("submitting")}
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {isRegenerate ? t("regenerateSubmit") : t("submit")}
              <span className="ml-1.5 flex items-center text-xs opacity-70">
                <Coins className="h-3 w-3 mr-0.5" />
                {requiredCredits}
              </span>
            </>
          )}
        </Button>
      </div>

      {/* 素材库选择器 */}
      <AssetLibraryPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        projectId={projectId}
        selectedAssetIds={referenceAssetIds}
        onConfirm={handleReferenceConfirm}
        maxSelection={7}
        title={t("selectReference")}
        description={t("selectReferenceDescription")}
      />

      {/* 积分不足购买弹窗 */}
      <PurchaseDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
      />
    </div>
  );
}
