"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useEditor } from "../editor-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Sparkles,
  Image as ImageIcon,
  Settings,
  Loader2,
  Check,
  ChevronDown,
  X,
  Send,
  AlertCircle,
  User,
  MapPin,
  Package,
  Pencil,
} from "lucide-react";
import { generateAssetImage, editAssetImage } from "@/lib/actions/asset/generate-asset";
import type { ImageResolution } from "@/types/asset";
import type { AspectRatio } from "@/lib/services/image.service";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getAssetsByIds } from "@/lib/actions/asset";
import { useTaskPolling } from "@/hooks/use-task-polling";
import type { AssetImageGenerationResult } from "@/types/job";
import { hasEnoughCredits } from "@/lib/actions/credits/balance";
import { PurchaseDialog } from "@/components/credits/purchase-dialog";
import { CREDIT_COSTS, PackageType } from "@/types/payment";
import { useTranslations } from "next-intl";
import { AssetLibraryPickerDialog } from "../shared/asset-library-picker-dialog";

interface AssetGenerationEditorProps {
  projectId: string;
}

// 宽高比选项
const ASPECT_RATIO_OPTIONS: Array<{ labelKey: string; value: AspectRatio }> = [
  { labelKey: "aspectRatios.ultrawide", value: "21:9" },
  { labelKey: "aspectRatios.widescreen", value: "16:9" },
  { labelKey: "aspectRatios.standard32", value: "3:2" },
  { labelKey: "aspectRatios.standard43", value: "4:3" },
  { labelKey: "aspectRatios.square", value: "1:1" },
  { labelKey: "aspectRatios.portrait34", value: "3:4" },
  { labelKey: "aspectRatios.portrait23", value: "2:3" },
  { labelKey: "aspectRatios.portrait916", value: "9:16" },
];

export function AssetGenerationEditor({ projectId }: AssetGenerationEditorProps) {
  const {
    state,
    setSelectedSourceAssets,
    clearEditingAsset,
  } = useEditor();

  const { assetGeneration } = state;
  const { editingAsset, prefillParams } = assetGeneration;
  const t = useTranslations("credits");
  const tEditor = useTranslations("editor.assetGeneration");
  const tCommon = useTranslations("common");
  const tToast = useTranslations("toasts");
  const tEditorCommon = useTranslations("editor");

  // 使用任务轮询
  const { jobs, refresh: refreshJobs } = useTaskPolling();

  // UI 状态
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  // 从素材库选择的素材（只保留显示必需的字段）
  const [selectedAssets, setSelectedAssets] = useState<Array<{
    id: string;
    name: string;
    displayUrl: string | null;
  }>>([]);

  // 用于防止竞态条件
  const currentRequestRef = useRef<string>("");
  
  // 表单状态（移除assetName）
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [resolution, setResolution] = useState<ImageResolution>("2K");
  const [numImages, setNumImages] = useState(1);

  // 是否正在编辑素材
  const isEditing = editingAsset !== null;

  // 预填充表单参数（当从素材编辑进入时）
  useEffect(() => {
    if (prefillParams) {
      if (prefillParams.prompt) {
        setPrompt(prefillParams.prompt);
      }
      if (prefillParams.aspectRatio) {
        setAspectRatio(prefillParams.aspectRatio);
      }
      if (prefillParams.resolution) {
        setResolution(prefillParams.resolution);
      }
    }
  }, [prefillParams]);

  // 任务状态
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [generatedAssets, setGeneratedAssets] = useState<AssetImageGenerationResult["assets"]>([]);

  // 积分相关状态
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);

  // 当前正在执行的任务
  const currentJob = useMemo(() => {
    if (!currentJobId) return null;
    return jobs.find(job => job.id === currentJobId && job.type === "asset_image");
  }, [currentJobId, jobs]);

  // 是否正在生成
  const isGenerating = useMemo(() => {
    return currentJob?.status === "pending" || currentJob?.status === "processing";
  }, [currentJob]);

  // 监听任务完成
  useEffect(() => {
    if (!currentJob) return;

    if (currentJob.status === "completed") {
      // 任务完成
      try {
        const result: AssetImageGenerationResult = (currentJob.resultData || {}) as AssetImageGenerationResult;
        setGeneratedAssets(result.assets || []);
        toast.success(tEditor("successGenerated", { count: result.assets?.length || 0 }));

        // 注意：素材列表刷新由 editor-context.tsx 中的 useTaskRefresh 统一处理

        // 如果是编辑模式，清除编辑状态
        if (isEditing) {
          clearEditingAsset();
        }

        // 清空当前任务ID
        setTimeout(() => {
          setCurrentJobId(null);
        }, 2000);
      } catch (error) {
        console.error("解析任务结果失败:", error);
        toast.error(tToast("error.parseResultFailed"));
      }
    } else if (currentJob.status === "failed") {
      // 任务失败
      toast.error(currentJob.errorMessage || tToast("error.generationFailed"));
      setCurrentJobId(null);
    }
  }, [currentJob, tToast, isEditing, clearEditingAsset]);

  // 加载选中的素材详情（使用 ref 防止竞态条件）
  useEffect(() => {
    const requestId = JSON.stringify(assetGeneration.selectedSourceAssets.slice().sort());
    currentRequestRef.current = requestId;

    if (assetGeneration.selectedSourceAssets.length === 0) {
      setSelectedAssets([]);
      return;
    }

    const loadAssets = async () => {
      const result = await getAssetsByIds(assetGeneration.selectedSourceAssets);
      // 只有当请求仍然有效时才更新状态
      if (currentRequestRef.current === requestId && result.success && result.assets) {
        setSelectedAssets(result.assets);
      }
    };

    loadAssets();

    return () => {
      currentRequestRef.current = "";
    };
  }, [assetGeneration.selectedSourceAssets]);

  // 智能占位符：根据是否有参考图动态显示
  const placeholder = useMemo(() => {
    const hasImages = selectedAssets.length > 0;

    if (hasImages) {
      return tEditor("placeholders.withReference");
    }

    return tEditor("placeholders.withoutReference");
  }, [selectedAssets.length, tEditor]);

  // 处理从素材库选择图片（只设置 ID，由 useEffect 统一加载）
  const handleAssetPickerConfirm = (assetIds: string[]) => {
    setSelectedSourceAssets(assetIds);
    toast.success(tEditor("selectedImages", { count: assetIds.length }));
  };

  const handleRemoveSelectedAsset = (assetId: string) => {
    const newAssetIds = assetGeneration.selectedSourceAssets.filter(id => id !== assetId);
    setSelectedSourceAssets(newAssetIds);
  };

  // 生成图片 - 创建后台任务
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error(tToast("error.promptRequired"));
      return;
    }

    // 检查积分是否充足
    const requiredCredits = CREDIT_COSTS.IMAGE_GENERATION * numImages;
    const creditCheck = await hasEnoughCredits(requiredCredits);
    
    if (!creditCheck.success || !creditCheck.hasEnough) {
      // 积分不足，打开购买弹窗
      toast.error(t("insufficientTitle"));
      setPurchaseDialogOpen(true);
      return;
    }

    setGeneratedAssets([]);

    try {
      let result;
      
      // 获取所有参考图的ID
      const allReferenceIds = assetGeneration.selectedSourceAssets;

      if (allReferenceIds.length > 0) {
        // 图生图模式
        result = await editAssetImage({
          projectId,
          sourceAssetIds: allReferenceIds,
          editPrompt: prompt.trim(),
          aspectRatio,
          resolution,
          numImages,
        });
      } else {
        // 文生图模式（AI 会自动分析 prompt 生成 name 和 tags）
        result = await generateAssetImage({
          projectId,
          prompt: prompt.trim(),
          aspectRatio,
          resolution,
          numImages,
        });
      }

      if (result.success && result.jobId) {
        setCurrentJobId(result.jobId);
        toast.success(tToast("success.taskCreatedAiProcessing"));

        // 立即刷新任务列表
        refreshJobs();
      } else {
        toast.error(result.error || tToast("error.createTaskFailed"));
      }
    } catch (error) {
      console.error("Create task failed:", error);
      toast.error(tToast("error.createTaskFailed"));
    }
  }, [
    prompt,
    projectId,
    aspectRatio,
    resolution,
    numImages,
    assetGeneration,
    refreshJobs,
    t,
    tToast,
  ]);

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* 标题栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">{tEditor("title")}</h2>
          </div>
          <Badge variant="outline" className="text-xs">Nano Banana</Badge>
        </div>

        {/* 编辑模式提示 */}
        {isEditing && editingAsset && (
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-primary/5 border-primary/20">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Pencil className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm truncate">
                {tEditorCommon("assetGeneration.editing")}: <span className="font-medium">{editingAsset.name}</span>
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs shrink-0"
              onClick={() => {
                clearEditingAsset();
                setPrompt("");
                setAspectRatio("16:9");
                setResolution("2K");
                setNumImages(1);
                setSelectedSourceAssets([]);
              }}
            >
              {tEditorCommon("assetGeneration.cancelEdit")}
            </Button>
          </div>
        )}

        {/* 引导区域 */}
        <div className="rounded-lg border bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium mb-2">{t("guide.title")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">{t("guide.character").split(" - ")[0]}</span>
                    <span className="text-muted-foreground"> - {t("guide.character").split(" - ")[1]}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">{t("guide.scene").split(" - ")[0]}</span>
                    <span className="text-muted-foreground"> - {t("guide.scene").split(" - ")[1]}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Package className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">{t("guide.prop").split(" - ")[0]}</span>
                    <span className="text-muted-foreground"> - {t("guide.prop").split(" - ")[1]}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 主卡片 */}
        <Card className="border overflow-hidden">
          <CardContent className="p-0">
            {/* 参考图片区域 */}
            <div
              className={cn(
                "relative border-b bg-muted/20 transition-all",
                selectedAssets.length === 0 ? "min-h-[240px]" : "min-h-[160px]",
                isGenerating && "opacity-60"
              )}
            >
              {selectedAssets.length === 0 ? (
                <div 
                  onClick={() => !isGenerating && setAssetPickerOpen(true)}
                  className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center gap-3 cursor-pointer",
                    isGenerating && "cursor-not-allowed"
                  )}
                >
                  <div className="w-12 h-12 rounded-full bg-background border flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      {tEditor("selectReference")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tEditor("multipleReference")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex flex-wrap gap-3">
                    {/* 从素材库选择的素材 */}
                    {selectedAssets.map((asset) => (
                      <div key={asset.id} className="relative group">
                        <div className="w-24 h-24 rounded-lg overflow-hidden border bg-background">
                          {asset.displayUrl ? (
                            <Image
                              src={asset.displayUrl}
                              alt={asset.name}
                              width={96}
                              height={96}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted/50">
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSelectedAsset(asset.id);
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-1 left-1 right-1 bg-primary/90 text-primary-foreground text-[10px] px-1 py-0.5 rounded truncate">
                          {asset.name}
                        </div>
                      </div>
                    ))}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssetPickerOpen(true);
                      }}
                      className="w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 对话框内容区域 */}
            <div className="p-6 space-y-4">
              {/* 提示词输入 */}
              <div className="space-y-2">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={placeholder}
                  rows={6}
                  disabled={isGenerating}
                  className="resize-none text-sm border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
                />
              </div>

              {/* 简单的参数选择行 */}
              <div className="flex items-center gap-2 text-sm flex-wrap">
                {/* 模型选择 */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-background">
                  <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <Select value="nano-banana-pro" disabled>
                    <SelectTrigger className="h-auto border-0 p-0 bg-transparent focus:ring-0 text-xs font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nano-banana-pro">Nano Banana Pro 2K</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 高级参数折叠 */}
                <Collapsible open={showAdvancedParams} onOpenChange={setShowAdvancedParams}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 gap-1 text-xs"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      {tEditor("advancedParams")}
                      <ChevronDown className={cn(
                        "w-3.5 h-3.5 transition-transform",
                        showAdvancedParams && "rotate-180"
                      )} />
                    </Button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-3">
                      {/* 宽高比 */}
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{tEditor("aspectRatio")}</Label>
                        <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)} disabled={isGenerating}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASPECT_RATIO_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value} className="text-xs">
                                {tEditor(option.labelKey)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 分辨率 */}
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{tEditor("resolution")}</Label>
                        <Select value={resolution} onValueChange={(v) => setResolution(v as ImageResolution)} disabled={isGenerating}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1K" className="text-xs">1K</SelectItem>
                            <SelectItem value="2K" className="text-xs">2K</SelectItem>
                            <SelectItem value="4K" className="text-xs">4K</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 生成数量 */}
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{tEditor("quantity")}</Label>
                        <Select value={numImages.toString()} onValueChange={(v) => setNumImages(parseInt(v))} disabled={isGenerating}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1" className="text-xs">{tEditor("images", { count: 1 })}</SelectItem>
                            <SelectItem value="2" className="text-xs">{tEditor("images", { count: 2 })}</SelectItem>
                            <SelectItem value="3" className="text-xs">{tEditor("images", { count: 3 })}</SelectItem>
                            <SelectItem value="4" className="text-xs">{tEditor("images", { count: 4 })}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* 生成按钮放在右下角 */}
                <div className="ml-auto">
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    size="sm"
                    className="gap-1.5 h-7"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {tEditor("processing")}
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        {tEditor("generate")}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 任务进度展示 */}
        {currentJob && isGenerating && (
          <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                <span className="text-sm font-medium">{tEditor("creating")}</span>
                <Badge variant="secondary" className="text-xs ml-auto">
                  {currentJob.progress}%
                </Badge>
              </div>
              <Progress value={currentJob.progress} className="h-2" />
              {currentJob.progressMessage && (
                <p className="text-xs text-muted-foreground">
                  {currentJob.progressMessage}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* 任务失败展示 */}
        {currentJob && currentJob.status === "failed" && (
          <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-sm font-medium">{tEditor("failed")}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {currentJob.errorMessage || tCommon("error")}
              </p>
            </CardContent>
          </Card>
        )}

        {/* 创作成功结果 */}
        {generatedAssets.length > 0 && (
          <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium">{tEditor("success")}</span>
                <Badge variant="secondary" className="text-xs">{tEditor("images", { count: generatedAssets.length })}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {tEditor("savedToLibrary")}
              </p>
              <div className="grid grid-cols-4 gap-3">
                {generatedAssets.map((asset) => (
                  <div key={asset.id} className="space-y-1.5">
                    <div className="relative aspect-square rounded-lg overflow-hidden border bg-background">
                      {asset.imageUrl ? (
                        <Image
                          src={asset.imageUrl}
                          alt={asset.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-center truncate">{asset.name}</p>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {asset.tags.slice(0, 3).map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 积分不足购买弹窗 */}
      <PurchaseDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
        highlightPackage={PackageType.STARTER}
      />

      {/* 素材库选择弹窗 */}
      <AssetLibraryPickerDialog
        open={assetPickerOpen}
        onOpenChange={setAssetPickerOpen}
        projectId={projectId}
        selectedAssetIds={assetGeneration.selectedSourceAssets}
        onConfirm={handleAssetPickerConfirm}
        maxSelection={10}
      />
    </ScrollArea>
  );
}

