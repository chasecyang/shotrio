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
import { regenerateVideoAssetWithParams } from "@/lib/actions/asset";
import type { AssetWithFullData, ImageResolution, VideoGenerationConfig } from "@/types/asset";
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

  // 检测是否为视频
  const isVideo = asset.assetType === "video";

  // 解析视频配置
  const videoConfig = useMemo(() => {
    if (!isVideo || !asset.generationConfig) return null;
    try {
      return JSON.parse(asset.generationConfig) as VideoGenerationConfig;
    } catch {
      return null;
    }
  }, [isVideo, asset.generationConfig]);

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
    isVideo && videoConfig?.aspect_ratio
      ? videoConfig.aspect_ratio
      : originalConfig?.aspectRatio ?? "auto"
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
  const [isLoadingReferences, setIsLoadingReferences] = useState(
    isVideo ? isRegenerate : true
  );

  // 视频首尾帧状态
  const [startImageAssetId, setStartImageAssetId] = useState<string | null>(null);
  const [endImageAssetId, setEndImageAssetId] = useState<string | null>(null);
  const [startImageAsset, setStartImageAsset] = useState<{
    id: string;
    name: string;
    displayUrl: string | null;
  } | null>(null);
  const [endImageAsset, setEndImageAsset] = useState<{
    id: string;
    name: string;
    displayUrl: string | null;
  } | null>(null);
  const [startFramePickerOpen, setStartFramePickerOpen] = useState(false);
  const [endFramePickerOpen, setEndFramePickerOpen] = useState(false);

  // 积分相关状态
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const requiredCredits = isVideo
    ? CREDIT_COSTS.VIDEO_GENERATION_PER_SECOND * 8
    : CREDIT_COSTS.IMAGE_GENERATION;

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

  // edit 模式：初始化加载当前素材作为参考图
  useEffect(() => {
    if (isRegenerate || isVideo) return;

    const initEditReferenceAssets = async () => {
      setIsLoadingReferences(true);
      // 编辑模式下，将当前素材作为参考图
      setReferenceAssetIds([asset.id]);
      await loadReferenceAssets([asset.id]);
      setIsLoadingReferences(false);
    };
    initEditReferenceAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegenerate, isVideo, asset.id]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegenerate, asset.id]);

  // regenerate 模式：初始化加载视频首尾帧
  useEffect(() => {
    if (!isRegenerate || !isVideo) return;

    const initVideoFrames = async () => {
      setIsLoadingReferences(true);
      const frameIds = asset.sourceAssetIds || [];
      if (frameIds.length > 0) {
        setStartImageAssetId(frameIds[0]);
        if (frameIds.length > 1) {
          setEndImageAssetId(frameIds[1]);
        }
        const result = await getAssetsByIds(frameIds);
        if (result.success && result.assets) {
          const startFrame = result.assets.find(a => a.id === frameIds[0]);
          if (startFrame) setStartImageAsset(startFrame);
          if (frameIds.length > 1) {
            const endFrame = result.assets.find(a => a.id === frameIds[1]);
            if (endFrame) setEndImageAsset(endFrame);
          }
        }
      }
      setIsLoadingReferences(false);
    };
    initVideoFrames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegenerate, isVideo, asset.id]);

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

  // 处理起始帧选择
  const handleStartFrameConfirm = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const frameId = ids[0];
    setStartImageAssetId(frameId);
    const result = await getAssetsByIds([frameId]);
    if (result.success && result.assets && result.assets[0]) {
      setStartImageAsset(result.assets[0]);
    }
  }, []);

  // 处理结束帧选择
  const handleEndFrameConfirm = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setEndImageAssetId(null);
      setEndImageAsset(null);
      return;
    }
    const frameId = ids[0];
    setEndImageAssetId(frameId);
    const result = await getAssetsByIds([frameId]);
    if (result.success && result.assets && result.assets[0]) {
      setEndImageAsset(result.assets[0]);
    }
  }, []);

  // 提交编辑
  const handleSubmit = async () => {
    if (!editPrompt.trim()) {
      toast.error(t("promptRequired"));
      return;
    }

    // 视频特定验证
    if (isVideo && !startImageAssetId) {
      toast.error("请选择起始帧");
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
      if (isVideo) {
        const result = await regenerateVideoAssetWithParams({
          assetId: asset.id,
          editPrompt: editPrompt.trim(),
          aspectRatio: aspectRatio as "16:9" | "9:16",
          startImageAssetId: startImageAssetId!,
          endImageAssetId: endImageAssetId || undefined,
        });

        if (result.success) {
          toast.success(t("regenerateSuccess"));
          window.dispatchEvent(new CustomEvent("asset-created"));
          window.dispatchEvent(new CustomEvent("credits-changed"));
          onSuccess();
          onBack();
        } else {
          toast.error(result.error || t("submitFailed"));
        }
      } else {
        const result = await editAssetImageAsVersion({
          assetId: asset.id,
          editPrompt: editPrompt.trim(),
          sourceAssetIds: referenceAssetIds,
          aspectRatio,
          resolution,
        });

        if (result.success) {
          toast.success(isRegenerate ? t("regenerateSuccess") : t("submitSuccess"));
          window.dispatchEvent(new CustomEvent("asset-created"));
          window.dispatchEvent(new CustomEvent("credits-changed"));
          onSuccess();
          onBack();
        } else {
          toast.error(result.error || t("submitFailed"));
        }
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
          {/* 参考图片 - 仅图片显示 */}
          {!isVideo && (
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
          )}

          {/* 视频首尾帧 - 仅视频显示 */}
          {isVideo && (
            <div className="space-y-2">
              <Label className="text-xs">起始帧和结束帧</Label>
              <div className="space-y-3">
                {/* 起始帧 */}
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1.5">起始帧 *</div>
                  <div className="flex gap-3">
                    {isLoadingReferences ? (
                      <div className="w-24 h-24 rounded-xl border border-border/50 bg-muted/20 animate-pulse" />
                    ) : startImageAsset ? (
                      <div className="relative group w-24 h-24 rounded-xl overflow-hidden border border-border/50 bg-muted/20 shadow-sm">
                        {startImageAsset.displayUrl ? (
                          <Image
                            src={startImageAsset.displayUrl}
                            alt="起始帧"
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                        )}
                        <button
                          onClick={() => setStartFramePickerOpen(true)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs"
                        >
                          更换
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setStartFramePickerOpen(true)}
                        className={cn(
                          "w-24 h-24 rounded-xl border-2 border-dashed border-border/60",
                          "flex items-center justify-center",
                          "text-muted-foreground/60 hover:text-muted-foreground hover:border-border hover:bg-muted/30",
                          "transition-all"
                        )}
                      >
                        <Plus className="h-6 w-6" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 结束帧 */}
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1.5">结束帧（可选）</div>
                  <div className="flex gap-3">
                    {isLoadingReferences ? (
                      <div className="w-24 h-24 rounded-xl border border-border/50 bg-muted/20 animate-pulse" />
                    ) : endImageAsset ? (
                      <div className="relative group w-24 h-24 rounded-xl overflow-hidden border border-border/50 bg-muted/20 shadow-sm">
                        {endImageAsset.displayUrl ? (
                          <Image
                            src={endImageAsset.displayUrl}
                            alt="结束帧"
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setEndImageAssetId(null);
                            setEndImageAsset(null);
                          }}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEndFramePickerOpen(true)}
                        className={cn(
                          "w-24 h-24 rounded-xl border-2 border-dashed border-border/60",
                          "flex items-center justify-center",
                          "text-muted-foreground/60 hover:text-muted-foreground hover:border-border hover:bg-muted/30",
                          "transition-all"
                        )}
                      >
                        <Plus className="h-6 w-6" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

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
                videoOnly={isVideo}
              />
            </div>
            {!isVideo && (
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t("resolution")}</Label>
                <ResolutionSelector
                  value={resolution}
                  onChange={setResolution}
                />
              </div>
            )}
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

      {/* 起始帧选择器 */}
      <AssetLibraryPickerDialog
        open={startFramePickerOpen}
        onOpenChange={setStartFramePickerOpen}
        projectId={projectId}
        selectedAssetIds={startImageAssetId ? [startImageAssetId] : []}
        onConfirm={handleStartFrameConfirm}
        maxSelection={1}
        title="选择起始帧"
        description="选择一张图片作为视频的起始帧"
      />

      {/* 结束帧选择器 */}
      <AssetLibraryPickerDialog
        open={endFramePickerOpen}
        onOpenChange={setEndFramePickerOpen}
        projectId={projectId}
        selectedAssetIds={endImageAssetId ? [endImageAssetId] : []}
        onConfirm={handleEndFrameConfirm}
        maxSelection={1}
        title="选择结束帧"
        description="选择一张图片作为视频的结束帧（可选）"
      />

      {/* 积分不足购买弹窗 */}
      <PurchaseDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
      />
    </div>
  );
}
