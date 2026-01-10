"use client";

import { useState, useCallback } from "react";
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

interface AssetEditModeProps {
  asset: AssetWithFullData;
  projectId: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function AssetEditMode({
  asset,
  projectId,
  onBack,
  onSuccess,
}: AssetEditModeProps) {
  const t = useTranslations("editor.assetEdit");
  const tCommon = useTranslations("common");

  // 表单状态
  const [editPrompt, setEditPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio | "auto">("auto");
  const [resolution, setResolution] = useState<ImageResolution>("2K");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 参考图选择
  const [referenceAssetIds, setReferenceAssetIds] = useState<string[]>([]);
  const [referenceAssets, setReferenceAssets] = useState<Array<{
    id: string;
    name: string;
    displayUrl: string | null;
  }>>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

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
        toast.success(t("submitSuccess"));
        // 触发素材刷新事件
        window.dispatchEvent(new CustomEvent("asset-created"));
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
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <Badge variant="secondary" className="ml-auto text-xs">
          {asset.name}
        </Badge>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-xl mx-auto space-y-6">
          {/* 原图预览 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t("originalImage")}
            </Label>
            <div className="relative aspect-video w-full max-w-xs rounded-xl overflow-hidden border border-border/50 bg-muted/20 shadow-sm">
              {asset.displayUrl ? (
                <Image
                  src={asset.displayUrl}
                  alt={asset.name}
                  fill
                  className="object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
                </div>
              )}
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

          {/* 参考图片 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("referenceImages")}</Label>
              <span className="text-[10px] text-muted-foreground">
                {t("optional")}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {referenceAssets.map((refAsset) => (
                <div
                  key={refAsset.id}
                  className="relative group w-14 h-14 rounded-lg overflow-hidden border border-border/50 bg-muted/20 shadow-sm transition-shadow hover:shadow-md"
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
                      <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                  )}
                  <button
                    onClick={() => removeReferenceAsset(refAsset.id)}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setPickerOpen(true)}
                className={cn(
                  "w-14 h-14 rounded-lg border border-dashed border-border/60",
                  "flex items-center justify-center",
                  "text-muted-foreground/60 hover:text-muted-foreground hover:border-border hover:bg-muted/30",
                  "transition-all"
                )}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
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
              {t("submitting")}
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {t("submit")}
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
    </div>
  );
}
