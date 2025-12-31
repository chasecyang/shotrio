"use client";

import { useState, useCallback, useMemo, useRef, DragEvent, useEffect } from "react";
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
  Upload,
  X,
  Send,
  AlertCircle,
  User,
  MapPin,
  Package,
} from "lucide-react";
import { generateAssetImage, editAssetImage } from "@/lib/actions/asset/generate-asset";
import type { ImageResolution } from "@/types/asset";
import type { AspectRatio } from "@/lib/services/fal.service";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { uploadAsset } from "@/lib/actions/asset/upload-asset";
import { getAsset } from "@/lib/actions/asset";
import { useTaskPolling } from "@/hooks/use-task-polling";
import type { AssetImageGenerationResult } from "@/types/job";
import type { AssetWithTags } from "@/types/asset";
import { hasEnoughCredits } from "@/lib/actions/credits/balance";
import { PurchaseDialog } from "@/components/credits/purchase-dialog";
import { CREDIT_COSTS, PackageType } from "@/types/payment";
import { useTranslations } from "next-intl";

interface AssetGenerationEditorProps {
  projectId: string;
}

// 宽高比选项
const ASPECT_RATIO_OPTIONS: Array<{ label: string; value: AspectRatio }> = [
  { label: "21:9 (超宽)", value: "21:9" },
  { label: "16:9 (宽屏)", value: "16:9" },
  { label: "3:2", value: "3:2" },
  { label: "4:3", value: "4:3" },
  { label: "1:1 (方形)", value: "1:1" },
  { label: "3:4 (竖版)", value: "3:4" },
  { label: "2:3", value: "2:3" },
  { label: "9:16 (竖屏)", value: "9:16" },
];

export function AssetGenerationEditor({ projectId }: AssetGenerationEditorProps) {
  const { 
    state,
    setSelectedSourceAssets,
  } = useEditor();

  const { assetGeneration } = state;
  const t = useTranslations("credits");
  const tToast = useTranslations("toasts");

  // 使用任务轮询
  const { jobs, refresh: refreshJobs } = useTaskPolling();

  // UI 状态
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImages, setUploadedImages] = useState<Array<{
    file: File;
    preview: string;
    id: string;
  }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // 从素材库选择的素材
  const [selectedAssets, setSelectedAssets] = useState<AssetWithTags[]>([]);
  
  // 表单状态（移除assetName）
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [resolution, setResolution] = useState<ImageResolution>("2K");
  const [numImages, setNumImages] = useState(1);

  // 任务状态
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [generatedAssets, setGeneratedAssets] = useState<AssetImageGenerationResult["assets"]>([]);

  // 积分相关状态
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);

  // 当前正在执行的任务
  const currentJob = useMemo(() => {
    if (!currentJobId) return null;
    return jobs.find(job => job.id === currentJobId && job.type === "asset_image_generation");
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
        toast.success(`成功生成 ${result.assets?.length || 0} 张图片`);
        
        // 注意：素材列表刷新由 editor-context.tsx 中的 useTaskRefresh 统一处理
        
        // 清空当前任务ID和上传的图片
        setTimeout(() => {
          setCurrentJobId(null);
          uploadedImages.forEach(img => URL.revokeObjectURL(img.preview));
          setUploadedImages([]);
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
  }, [currentJob, uploadedImages, tToast]);

  // 加载选中的素材详情
  useEffect(() => {
    const loadSelectedAssets = async () => {
      const assets: AssetWithTags[] = [];
      for (const assetId of assetGeneration.selectedSourceAssets) {
        const result = await getAsset(assetId);
        if (result.success && result.asset) {
          assets.push(result.asset);
        }
      }
      setSelectedAssets(assets);
    };

    if (assetGeneration.selectedSourceAssets.length > 0) {
      loadSelectedAssets();
    } else {
      setSelectedAssets([]);
    }
  }, [assetGeneration.selectedSourceAssets]);

  // 智能占位符：根据是否有参考图动态显示
  const placeholder = useMemo(() => {
    const hasImages = uploadedImages.length > 0 || selectedAssets.length > 0;
    
    if (hasImages) {
      return "基于参考图进行创作，例如：调整为温暖的日落色调，保持人物姿势和表情不变...";
    }
    
    return "详细描述你想要创作的内容，例如：一位30岁的亚洲女性，短发，现代职业装，自信的微笑...";
  }, [uploadedImages.length, selectedAssets.length]);

  // 处理文件拖拽
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isGenerating && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // 只有当鼠标真正离开容器时才取消拖拽状态
    // 检查 relatedTarget 是否在当前元素内
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (
      x <= rect.left ||
      x >= rect.right ||
      y <= rect.top ||
      y >= rect.bottom
    ) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isGenerating || isUploading) return;

    // 尝试获取素材数据（从素材库拖拽）
    const assetData = e.dataTransfer.getData("application/json");
    if (assetData) {
      try {
        const { assetId } = JSON.parse(assetData);
        if (assetId && !assetGeneration.selectedSourceAssets.includes(assetId)) {
          setSelectedSourceAssets([...assetGeneration.selectedSourceAssets, assetId]);
          toast.success(tToast("success.referenceAssetAdded"));
        }
        return;
      } catch (error) {
        console.error("解析素材数据失败:", error);
      }
    }

    // 如果没有素材数据，尝试处理文件
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );

    if (files.length > 0) {
      await handleFiles(files);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFiles(Array.from(files));
    }
  };

  const handleFiles = async (files: File[]) => {
    setIsUploading(true);
    try {
      const newImages = files.map(file => ({
        file,
        preview: URL.createObjectURL(file),
        id: Math.random().toString(36).substring(7),
      }));
      
      setUploadedImages(prev => [...prev, ...newImages]);
      toast.success(`${files.length} images added`);
    } catch {
      toast.error(tToast("error.addImageFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (id: string) => {
    setUploadedImages(prev => {
      const updated = prev.filter(img => img.id !== id);
      // 释放 URL
      const removed = prev.find(img => img.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.preview);
      }
      return updated;
    });
  };

  const handleRemoveSelectedAsset = (assetId: string) => {
    setSelectedSourceAssets(
      assetGeneration.selectedSourceAssets.filter(id => id !== assetId)
    );
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
      
      // 如果有上传的图片，先上传到服务器
      const uploadedAssetIds: string[] = [];
      if (uploadedImages.length > 0) {
        toast.info(tToast("info.uploadingReferenceImages"));
        for (const img of uploadedImages) {
          const uploadResult = await uploadAsset({
            projectId,
            userId: state.project?.userId || '',
            assetName: `ref_${Date.now()}`,
            file: img.file,
          });
          
          if (uploadResult.success && uploadResult.assetId) {
            uploadedAssetIds.push(uploadResult.assetId);
          }
        }
      }

      // 合并所有参考图的ID
      const allReferenceIds = [...uploadedAssetIds, ...assetGeneration.selectedSourceAssets];

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
        toast.error(result.error || "创建任务失败");
      }
    } catch (error) {
      console.error("创建任务失败:", error);
      toast.error(tToast("error.createTaskFailed"));
    }
  }, [
    prompt,
    projectId,
    aspectRatio,
    resolution,
    numImages,
    uploadedImages,
    assetGeneration,
    refreshJobs,
    state.project?.userId,
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
            <h2 className="text-lg font-semibold">AI 创作素材</h2>
          </div>
          <Badge variant="outline" className="text-xs">Nano Banana</Badge>
        </div>

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
            {/* 图片拖拽区域 */}
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={cn(
                "relative border-b bg-muted/20 transition-all",
                (uploadedImages.length === 0 && selectedAssets.length === 0) ? "min-h-[240px]" : "min-h-[160px]",
                isDragging && "border-primary bg-primary/5",
                (isGenerating || isUploading) && "opacity-60"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                disabled={isGenerating || isUploading}
              />

              {(uploadedImages.length === 0 && selectedAssets.length === 0) ? (
                <div 
                  onClick={() => !isGenerating && !isUploading && fileInputRef.current?.click()}
                  className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center gap-3 cursor-pointer",
                    (isGenerating || isUploading) && "cursor-not-allowed"
                  )}
                >
                  <div className="w-12 h-12 rounded-full bg-background border flex items-center justify-center">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      拖拽图片到此处，或点击上传
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      也可以从左侧创作素材库拖拽素材作为参考
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
                          {asset.imageUrl ? (
                            <Image
                              src={asset.thumbnailUrl || asset.imageUrl}
                              alt={asset.name}
                              width={96}
                              height={96}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted/50">
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
                          创作素材库
                        </div>
                      </div>
                    ))}
                    {/* 上传的图片 */}
                    {uploadedImages.map((img) => (
                      <div key={img.id} className="relative group">
                        <div className="w-24 h-24 rounded-lg overflow-hidden border bg-background">
                          <Image
                            src={img.preview}
                            alt="预览"
                            width={96}
                            height={96}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveImage(img.id);
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      <Upload className="w-5 h-5 text-muted-foreground" />
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
                  <Select value="nano-banana" disabled>
                    <SelectTrigger className="h-auto border-0 p-0 bg-transparent focus:ring-0 text-xs font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nano-banana">Nano Banana</SelectItem>
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
                      高级参数
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
                        <Label className="text-xs text-muted-foreground">宽高比</Label>
                        <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)} disabled={isGenerating}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASPECT_RATIO_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value} className="text-xs">
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 分辨率 */}
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">分辨率</Label>
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
                        <Label className="text-xs text-muted-foreground">数量</Label>
                        <Select value={numImages.toString()} onValueChange={(v) => setNumImages(parseInt(v))} disabled={isGenerating}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1" className="text-xs">1 张</SelectItem>
                            <SelectItem value="2" className="text-xs">2 张</SelectItem>
                            <SelectItem value="3" className="text-xs">3 张</SelectItem>
                            <SelectItem value="4" className="text-xs">4 张</SelectItem>
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
                        处理中
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        生成
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
                <span className="text-sm font-medium">AI 正在创作中...</span>
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
                <span className="text-sm font-medium">创作失败</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {currentJob.errorMessage || "未知错误"}
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
                <span className="text-sm font-medium">创作成功</span>
                <Badge variant="secondary" className="text-xs">{generatedAssets.length} 张</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                图片已自动保存到素材库，AI 已智能命名和打标签
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
    </ScrollArea>
  );
}

