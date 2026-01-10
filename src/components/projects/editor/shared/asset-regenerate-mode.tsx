"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface AssetRegenerateModeProps {
  asset: AssetWithFullData;
  projectId: string;
  onBack: () => void;
  onSuccess: () => void;
}

// 宽高比选项
const ASPECT_RATIO_OPTIONS: Array<{ labelKey: string; value: AspectRatio | "auto" }> = [
  { labelKey: "auto", value: "auto" },
  { labelKey: "21:9", value: "21:9" },
  { labelKey: "16:9", value: "16:9" },
  { labelKey: "3:2", value: "3:2" },
  { labelKey: "4:3", value: "4:3" },
  { labelKey: "1:1", value: "1:1" },
  { labelKey: "3:4", value: "3:4" },
  { labelKey: "2:3", value: "2:3" },
  { labelKey: "9:16", value: "9:16" },
];

// 分辨率选项
const RESOLUTION_OPTIONS: Array<{ label: string; value: ImageResolution }> = [
  { label: "1K (1024px)", value: "1K" },
  { label: "2K (2048px)", value: "2K" },
];

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

export function AssetRegenerateMode({
  asset,
  projectId,
  onBack,
  onSuccess,
}: AssetRegenerateModeProps) {
  const t = useTranslations("editor.assetRegenerate");
  const tEdit = useTranslations("editor.assetEdit");
  const tCommon = useTranslations("common");

  // 解析原始生成参数
  const originalConfig = parseGenerationConfig(asset.generationConfig);

  // 表单状态 - 预填充原始值
  const [editPrompt, setEditPrompt] = useState(asset.prompt || "");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio | "auto">(originalConfig.aspectRatio);
  const [resolution, setResolution] = useState<ImageResolution>(originalConfig.resolution);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 参考图选择 - 预加载原始参考图（排除当前素材自身）
  const [referenceAssetIds, setReferenceAssetIds] = useState<string[]>([]);
  const [referenceAssets, setReferenceAssets] = useState<Array<{
    id: string;
    name: string;
    displayUrl: string | null;
  }>>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isLoadingReferences, setIsLoadingReferences] = useState(true);

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

  // 初始化：加载原始参考图
  useEffect(() => {
    const initReferenceAssets = async () => {
      setIsLoadingReferences(true);
      // 过滤掉当前素材自身
      const originalIds = (asset.sourceAssetIds || []).filter(id => id !== asset.id);
      setReferenceAssetIds(originalIds);
      await loadReferenceAssets(originalIds);
      setIsLoadingReferences(false);
    };
    initReferenceAssets();
  }, [asset.id, asset.sourceAssetIds, loadReferenceAssets]);

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

  // 提交重新生成
  const handleSubmit = async () => {
    if (!editPrompt.trim()) {
      toast.error(tEdit("promptRequired"));
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
      console.error("Regenerate asset failed:", error);
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
        <Badge variant="secondary" className="ml-auto">
          {asset.name}
        </Badge>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-6 max-w-xl">
          {/* 原图预览 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {tEdit("originalImage")}
            </Label>
            <div className="relative aspect-video w-full max-w-sm rounded-lg overflow-hidden border bg-muted/30">
              {asset.displayUrl ? (
                <Image
                  src={asset.displayUrl}
                  alt={asset.name}
                  fill
                  className="object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          {/* Prompt 输入 */}
          <div className="space-y-2">
            <Label htmlFor="regenerate-prompt">{tEdit("promptLabel")}</Label>
            <Textarea
              id="regenerate-prompt"
              placeholder={tEdit("promptPlaceholder")}
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              className="min-h-[100px] resize-none"
            />
          </div>

          {/* 参考图片 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{tEdit("referenceImages")}</Label>
              <span className="text-xs text-muted-foreground">
                {tEdit("optional")}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {isLoadingReferences ? (
                <div className="w-16 h-16 rounded-lg border bg-muted/30 animate-pulse" />
              ) : (
                referenceAssets.map((refAsset) => (
                  <div
                    key={refAsset.id}
                    className="relative group w-16 h-16 rounded-lg overflow-hidden border bg-muted/30"
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
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <button
                      onClick={() => removeReferenceAsset(refAsset.id)}
                      className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
              <button
                onClick={() => setPickerOpen(true)}
                className={cn(
                  "w-16 h-16 rounded-lg border-2 border-dashed",
                  "flex items-center justify-center",
                  "text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  "transition-colors"
                )}
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* 生成参数 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{tEdit("aspectRatio")}</Label>
              <Select
                value={aspectRatio}
                onValueChange={(v) => setAspectRatio(v as AspectRatio | "auto")}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIO_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.value === "auto" ? tEdit("autoAspectRatio") : option.labelKey}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tEdit("resolution")}</Label>
              <Select
                value={resolution}
                onValueChange={(v) => setResolution(v as ImageResolution)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOLUTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 border-t flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          {tCommon("cancel")}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!editPrompt.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("submitting")}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
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
        title={tEdit("selectReference")}
        description={tEdit("selectReferenceDescription")}
      />
    </div>
  );
}
