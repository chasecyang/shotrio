"use client";

import { useState, useEffect, useCallback, useMemo, useRef, DragEvent } from "react";
import { useEditor } from "../editor-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Image as ImageIcon,
  Film,
  FileText,
  X,
  Upload,
  ArrowLeft,
  Loader2,
  Check,
  Sparkles,
} from "lucide-react";
import { createTextAsset } from "@/lib/actions/asset/text-asset";
import { generateAssetImage, editAssetImage } from "@/lib/actions/asset/generate-asset";
import { createVideoAsset } from "@/lib/actions/asset/crud";
import { queryAssets, getAsset } from "@/lib/actions/asset";
import { hasEnoughCredits } from "@/lib/actions/credits/balance";
import { uploadAsset } from "@/lib/actions/asset/upload-asset";
import { CREDIT_COSTS } from "@/types/payment";
import type { AssetWithTags, AssetWithRuntimeStatus, ImageResolution } from "@/types/asset";
import type { AspectRatio } from "@/lib/services/image.service";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { PurchaseDialog } from "@/components/credits/purchase-dialog";
import { useTaskPolling } from "@/hooks/use-task-polling";
import type { AssetImageGenerationResult } from "@/types/job";
import Image from "next/image";
import { useTranslations } from "next-intl";

interface AddAssetPanelProps {
  projectId: string;
  onBack: () => void;
  onSuccess?: () => void;
}

// 宽高比选项（图片）
const IMAGE_ASPECT_RATIOS: Array<{ label: string; value: AspectRatio }> = [
  { label: "21:9 (超宽)", value: "21:9" },
  { label: "16:9 (宽屏)", value: "16:9" },
  { label: "3:2", value: "3:2" },
  { label: "4:3", value: "4:3" },
  { label: "1:1 (方形)", value: "1:1" },
  { label: "3:4 (竖版)", value: "3:4" },
  { label: "2:3", value: "2:3" },
  { label: "9:16 (竖屏)", value: "9:16" },
];

// 视频宽高比选项
const VIDEO_ASPECT_RATIOS = [
  { label: "16:9 (宽屏)", value: "16:9" as const },
  { label: "9:16 (竖屏)", value: "9:16" as const },
  { label: "1:1 (方形)", value: "1:1" as const },
];

export function AddAssetPanel({ projectId, onBack, onSuccess }: AddAssetPanelProps) {
  const { state, setSelectedSourceAssets } = useEditor();
  const { assetGeneration } = state;
  const t = useTranslations("credits");
  const tToast = useTranslations("toasts");

  // 使用任务轮询
  const { jobs, refresh: refreshJobs } = useTaskPolling();

  // Tab状态
  const [activeTab, setActiveTab] = useState("image");

  // === 图片生成状态 ===
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageAspectRatio, setImageAspectRatio] = useState<AspectRatio>("16:9");
  const [imageResolution, setImageResolution] = useState<ImageResolution>("2K");
  const [numImages, setNumImages] = useState(1);
  const [uploadedImages, setUploadedImages] = useState<Array<{
    file: File;
    preview: string;
    id: string;
  }>>([]);
  const [selectedImageAssets, setSelectedImageAssets] = useState<AssetWithTags[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentImageJobId, setCurrentImageJobId] = useState<string | null>(null);
  const [generatedAssets, setGeneratedAssets] = useState<AssetImageGenerationResult["assets"]>([]);

  // === 视频生成状态 ===
  const [videoPrompt, setVideoPrompt] = useState("");
  const [startFrameAssetId, setStartFrameAssetId] = useState<string>("");
  const [endFrameAssetId, setEndFrameAssetId] = useState<string>("none");
  const [videoDuration, setVideoDuration] = useState<"5" | "10">("5");
  const [videoAspectRatio, setVideoAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [availableImageAssets, setAvailableImageAssets] = useState<AssetWithRuntimeStatus[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  // === 文本创建状态 ===
  const [textName, setTextName] = useState("");
  const [textContent, setTextContent] = useState("");
  const [textFormat, setTextFormat] = useState<"markdown" | "plain">("markdown");
  const [textTagInput, setTextTagInput] = useState("");
  const [textTags, setTextTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 积分相关
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);

  // 加载图片素材列表（用于视频生成）
  useEffect(() => {
    if (activeTab === "video") {
      loadImageAssets();
    }
  }, [activeTab, projectId]);

  const loadImageAssets = async () => {
    setIsLoadingImages(true);
    try {
      const result = await queryAssets({
        projectId,
        limit: 100,
      });
      const imageAssets = result.assets.filter(asset => asset.assetType === "image");
      setAvailableImageAssets(imageAssets);
    } catch (error) {
      console.error("加载图片素材失败:", error);
      toast.error("加载图片素材失败");
    } finally {
      setIsLoadingImages(false);
    }
  };

  // 加载选中的参考图片素材详情
  useEffect(() => {
    const loadSelectedAssets = async () => {
      const assets: AssetWithTags[] = [];
      for (const assetId of assetGeneration.selectedSourceAssets) {
        const result = await getAsset(assetId);
        if (result.success && result.asset) {
          assets.push(result.asset);
        }
      }
      setSelectedImageAssets(assets);
    };

    if (assetGeneration.selectedSourceAssets.length > 0) {
      loadSelectedAssets();
    } else {
      setSelectedImageAssets([]);
    }
  }, [assetGeneration.selectedSourceAssets]);

  // 监听图片生成任务完成
  const currentImageJob = useMemo(() => {
    if (!currentImageJobId) return null;
    return jobs.find(job => job.id === currentImageJobId && job.type === "asset_image_generation");
  }, [currentImageJobId, jobs]);

  const isGeneratingImage = useMemo(() => {
    return currentImageJob?.status === "pending" || currentImageJob?.status === "processing";
  }, [currentImageJob]);

  useEffect(() => {
    if (!currentImageJob) return;

    if (currentImageJob.status === "completed") {
      try {
        const result: AssetImageGenerationResult = (currentImageJob.resultData || {}) as AssetImageGenerationResult;
        setGeneratedAssets(result.assets || []);
        toast.success(`成功生成 ${result.assets?.length || 0} 张图片`);
        
        setTimeout(() => {
          setCurrentImageJobId(null);
          uploadedImages.forEach(img => URL.revokeObjectURL(img.preview));
          setUploadedImages([]);
          onSuccess?.();
        }, 2000);
      } catch (error) {
        console.error("解析任务结果失败:", error);
        toast.error(tToast("error.parseResultFailed"));
      }
    } else if (currentImageJob.status === "failed") {
      toast.error(currentImageJob.errorMessage || tToast("error.generationFailed"));
      setCurrentImageJobId(null);
    }
  }, [currentImageJob, uploadedImages, tToast, onSuccess]);

  // === 图片生成处理函数 ===
  const handleImageGenerate = useCallback(async () => {
    if (!imagePrompt.trim()) {
      toast.error("请输入提示词");
      return;
    }

    const requiredCredits = CREDIT_COSTS.IMAGE_GENERATION * numImages;
    const creditCheck = await hasEnoughCredits(requiredCredits);
    
    if (!creditCheck.success || !creditCheck.hasEnough) {
      toast.error(t("insufficientTitle"));
      setPurchaseDialogOpen(true);
      return;
    }

    setGeneratedAssets([]);

    try {
      let result;
      
      if (uploadedImages.length > 0) {
        // 有上传图片，先上传到服务器
        const uploadResults = await Promise.all(
          uploadedImages.map(img => uploadAsset({
            file: img.file,
            projectId,
            category: "reference",
          }))
        );

        const failedUploads = uploadResults.filter(r => !r.success);
        if (failedUploads.length > 0) {
          toast.error("部分图片上传失败");
          return;
        }

        const sourceAssetIds = uploadResults
          .filter(r => r.asset?.id)
          .map(r => r.asset!.id);

        result = await editAssetImage({
          projectId,
          prompt: imagePrompt.trim(),
          sourceAssetIds,
          aspectRatio: imageAspectRatio,
          resolution: imageResolution,
          numImages,
        });
      } else if (selectedImageAssets.length > 0) {
        // 使用素材库中的图片
        result = await editAssetImage({
          projectId,
          prompt: imagePrompt.trim(),
          sourceAssetIds: selectedImageAssets.map(a => a.id),
          aspectRatio: imageAspectRatio,
          resolution: imageResolution,
          numImages,
        });
      } else {
        // 文生图
        result = await generateAssetImage({
          projectId,
          prompt: imagePrompt.trim(),
          aspectRatio: imageAspectRatio,
          resolution: imageResolution,
          numImages,
        });
      }

      if (result.success && result.jobId) {
        setCurrentImageJobId(result.jobId);
        toast.success("图片生成任务已创建");
      } else {
        toast.error(result.error || "创建任务失败");
      }
    } catch (error) {
      console.error("生成失败:", error);
      toast.error("操作失败，请重试");
    }
  }, [imagePrompt, numImages, uploadedImages, selectedImageAssets, imageAspectRatio, imageResolution, projectId, t]);

  // 文件上传处理
  const handleFiles = async (files: File[]) => {
    setIsUploading(true);
    try {
      const newImages = files.map(file => ({
        file,
        preview: URL.createObjectURL(file),
        id: Math.random().toString(36).substring(7),
      }));
      setUploadedImages(prev => [...prev, ...newImages]);
      toast.success(`已添加 ${files.length} 张参考图`);
    } catch (error) {
      console.error("处理文件失败:", error);
      toast.error("处理文件失败");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      await handleFiles(imageFiles);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveUploadedImage = (id: string) => {
    setUploadedImages(prev => {
      const updated = prev.filter(img => img.id !== id);
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

  // === 视频生成处理函数 ===
  const handleVideoGenerate = async () => {
    if (!videoPrompt.trim()) {
      toast.error("请输入提示词");
      return;
    }

    if (!startFrameAssetId) {
      toast.error("请选择起始帧");
      return;
    }

    // 获取起始帧素材
    const startFrameResult = await getAsset(startFrameAssetId);
    if (!startFrameResult.success || !startFrameResult.asset?.imageUrl) {
      toast.error("无法获取起始帧图片");
      return;
    }

    let endFrameUrl: string | undefined;
    if (endFrameAssetId && endFrameAssetId !== "none") {
      const endFrameResult = await getAsset(endFrameAssetId);
      if (endFrameResult.success && endFrameResult.asset?.imageUrl) {
        endFrameUrl = endFrameResult.asset.imageUrl;
      }
    }

    const durationSeconds = parseInt(videoDuration);
    const requiredCredits = CREDIT_COSTS.VIDEO_GENERATION_PER_SECOND * durationSeconds;
    const creditCheck = await hasEnoughCredits(requiredCredits);
    
    if (!creditCheck.success || !creditCheck.hasEnough) {
      toast.error(t("insufficientTitle"));
      setPurchaseDialogOpen(true);
      return;
    }

    try {
      const result = await createVideoAsset({
        projectId,
        name: `视频-${Date.now()}`,
        prompt: videoPrompt.trim(),
        referenceAssetIds: endFrameAssetId && endFrameAssetId !== "none" ? [startFrameAssetId, endFrameAssetId] : [startFrameAssetId],
        generationConfig: {
          prompt: videoPrompt.trim(),
          start_image_url: startFrameResult.asset.imageUrl,
          end_image_url: endFrameUrl,
          duration: videoDuration,
          aspect_ratio: videoAspectRatio,
        },
      });

      if (result.success) {
        toast.success("视频生成任务已创建");
        setTimeout(() => {
          onSuccess?.();
          onBack();
        }, 1500);
      } else {
        toast.error(result.error || "创建任务失败");
      }
    } catch (error) {
      console.error("生成失败:", error);
      toast.error("操作失败，请重试");
    }
  };

  // === 文本创建处理函数 ===
  const handleAddTextTag = () => {
    const trimmedTag = textTagInput.trim();
    if (trimmedTag && !textTags.includes(trimmedTag)) {
      setTextTags([...textTags, trimmedTag]);
      setTextTagInput("");
    }
  };

  const handleRemoveTextTag = (tagToRemove: string) => {
    setTextTags(textTags.filter(t => t !== tagToRemove));
  };

  const handleTextSubmit = async () => {
    if (!textName.trim()) {
      toast.error("请输入资产名称");
      return;
    }

    if (!textContent.trim()) {
      toast.error("请输入文本内容");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createTextAsset({
        projectId,
        name: textName.trim(),
        content: textContent,
        format: textFormat,
        tags: textTags,
      });

      if (!result.success) {
        toast.error(result.error || "创建失败");
        setIsSubmitting(false);
        return;
      }

      toast.success("文本资产已创建");
      onSuccess?.();
      onBack();
    } catch (error) {
      console.error("提交失败:", error);
      toast.error("操作失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 计算积分消耗
  const imageCredits = CREDIT_COSTS.IMAGE_GENERATION * numImages;
  const videoCredits = CREDIT_COSTS.VIDEO_GENERATION_PER_SECOND * parseInt(videoDuration);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶部导航栏 */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </Button>
          <div className="h-4 w-px bg-border" />
          <h2 className="text-lg font-semibold">添加素材</h2>
        </div>
      </div>

      {/* 主内容区 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="image" className="flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4" />
              <span>图片</span>
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-1.5">
              <Film className="h-4 w-4" />
              <span>视频</span>
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              <span>文本</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 图片生成 Tab */}
        <TabsContent value="image" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6 max-w-4xl mx-auto">
              {/* 提示词 */}
              <div className="space-y-2">
                <Label>创作描述</Label>
                <Textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="详细描述你想要创作的内容，例如：一位30岁的亚洲女性，短发，现代职业装，自信的微笑..."
                  rows={4}
                  disabled={isGeneratingImage}
                  className="resize-none"
                />
              </div>

              {/* 参考图片选择 */}
              <div className="space-y-2">
                <Label>参考图片（可选）</Label>
                <div className="grid grid-cols-4 gap-3">
                  {/* 已上传的图片 */}
                  {uploadedImages.map((img) => (
                    <div key={img.id} className="relative aspect-square rounded-lg border overflow-hidden group">
                      <Image
                        src={img.preview}
                        alt="参考图"
                        fill
                        className="object-cover"
                      />
                      <button
                        onClick={() => handleRemoveUploadedImage(img.id)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {/* 从素材库选择的图片 */}
                  {selectedImageAssets.map((asset) => (
                    <div key={asset.id} className="relative aspect-square rounded-lg border overflow-hidden group">
                      {asset.imageUrl && (
                        <Image
                          src={asset.imageUrl}
                          alt={asset.name}
                          fill
                          className="object-cover"
                        />
                      )}
                      <button
                        onClick={() => handleRemoveSelectedAsset(asset.id)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {/* 上传按钮 */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGeneratingImage || isUploading}
                    className="aspect-square rounded-lg border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary"
                  >
                    <Upload className="w-5 h-5" />
                    <span>上传图片</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  可以上传本地图片或从素材库拖拽图片到此处作为参考
                </p>
              </div>

              {/* 生成参数 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>宽高比</Label>
                  <Select value={imageAspectRatio} onValueChange={(v) => setImageAspectRatio(v as AspectRatio)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMAGE_ASPECT_RATIOS.map(ratio => (
                        <SelectItem key={ratio.value} value={ratio.value}>
                          {ratio.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>生成数量</Label>
                  <Select value={numImages.toString()} onValueChange={(v) => setNumImages(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map(n => (
                        <SelectItem key={n} value={n.toString()}>
                          {n} 张
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 积分消耗提示 */}
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">积分消耗</span>
                  </div>
                  <Badge variant="secondary" className="text-base font-semibold">
                    {imageCredits} 积分
                  </Badge>
                </CardContent>
              </Card>

              {/* 生成进度 */}
              {isGeneratingImage && currentImageJob && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">生成中...</span>
                      <span className="text-sm text-muted-foreground">{currentImageJob.progress || 0}%</span>
                    </div>
                    <Progress value={currentImageJob.progress || 0} />
                    {currentImageJob.progressMessage && (
                      <p className="text-xs text-muted-foreground">{currentImageJob.progressMessage}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 生成结果 */}
              {generatedAssets.length > 0 && (
                <div className="space-y-2">
                  <Label>生成结果</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {generatedAssets.map((asset) => (
                      <div key={asset.id} className="relative aspect-video rounded-lg border overflow-hidden">
                        {asset.imageUrl && (
                          <Image
                            src={asset.imageUrl}
                            alt={asset.name}
                            fill
                            className="object-cover"
                          />
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                          <p className="text-xs text-white truncate">{asset.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* 底部操作栏 */}
          <div className="border-t p-4 flex justify-end gap-2">
            <Button variant="outline" onClick={onBack}>
              取消
            </Button>
            <Button
              onClick={handleImageGenerate}
              disabled={isGeneratingImage || !imagePrompt.trim()}
              className="gap-2"
            >
              {isGeneratingImage ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  生成图片
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* 视频生成 Tab */}
        <TabsContent value="video" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6 max-w-4xl mx-auto">
              {/* 提示词 */}
              <div className="space-y-2">
                <Label>视频描述</Label>
                <Textarea
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  placeholder="详细描述视频内容和镜头运动，例如：镜头缓慢推进，从冬日雪景过渡到春日花开..."
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* 首尾帧选择 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>起始帧（必填）</Label>
                  <Select value={startFrameAssetId} onValueChange={setStartFrameAssetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择起始帧" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingImages ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">加载中...</div>
                      ) : availableImageAssets.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">暂无图片素材</div>
                      ) : (
                        availableImageAssets.map(asset => (
                          <SelectItem key={asset.id} value={asset.id}>
                            {asset.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {startFrameAssetId && (
                    <div className="relative aspect-video rounded-lg border overflow-hidden">
                      {availableImageAssets.find(a => a.id === startFrameAssetId)?.imageUrl && (
                        <Image
                          src={availableImageAssets.find(a => a.id === startFrameAssetId)!.imageUrl!}
                          alt="起始帧"
                          fill
                          className="object-cover"
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>结束帧（可选）</Label>
                  <Select value={endFrameAssetId} onValueChange={setEndFrameAssetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择结束帧" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不使用结束帧</SelectItem>
                      {availableImageAssets.map(asset => (
                        <SelectItem key={asset.id} value={asset.id}>
                          {asset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {endFrameAssetId && endFrameAssetId !== "none" && (
                    <div className="relative aspect-video rounded-lg border overflow-hidden">
                      {availableImageAssets.find(a => a.id === endFrameAssetId)?.imageUrl && (
                        <Image
                          src={availableImageAssets.find(a => a.id === endFrameAssetId)!.imageUrl!}
                          alt="结束帧"
                          fill
                          className="object-cover"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 视频参数 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>时长</Label>
                  <Select value={videoDuration} onValueChange={(v) => setVideoDuration(v as "5" | "10")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 秒</SelectItem>
                      <SelectItem value="10">10 秒</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>宽高比</Label>
                  <Select value={videoAspectRatio} onValueChange={(v) => setVideoAspectRatio(v as "16:9" | "9:16" | "1:1")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VIDEO_ASPECT_RATIOS.map(ratio => (
                        <SelectItem key={ratio.value} value={ratio.value}>
                          {ratio.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 积分消耗提示 */}
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">积分消耗</span>
                  </div>
                  <Badge variant="secondary" className="text-base font-semibold">
                    {videoCredits} 积分
                  </Badge>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>

          {/* 底部操作栏 */}
          <div className="border-t p-4 flex justify-end gap-2">
            <Button variant="outline" onClick={onBack}>
              取消
            </Button>
            <Button
              onClick={handleVideoGenerate}
              disabled={!videoPrompt.trim() || !startFrameAssetId}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              生成视频
            </Button>
          </div>
        </TabsContent>

        {/* 文本创建 Tab */}
        <TabsContent value="text" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6 max-w-4xl mx-auto">
              {/* 名称 */}
              <div className="space-y-2">
                <Label htmlFor="name">资产名称</Label>
                <Input
                  id="name"
                  placeholder="例如：张三角色小传"
                  value={textName}
                  onChange={(e) => setTextName(e.target.value)}
                />
              </div>

              {/* 格式选择 */}
              <div className="space-y-2">
                <Label>文本格式</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={textFormat === "markdown" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTextFormat("markdown")}
                  >
                    Markdown
                  </Button>
                  <Button
                    type="button"
                    variant={textFormat === "plain" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTextFormat("plain")}
                  >
                    纯文本
                  </Button>
                </div>
              </div>

              {/* 标签 */}
              <div className="space-y-2">
                <Label htmlFor="tags">标签</Label>
                <div className="flex gap-2">
                  <Input
                    id="tags"
                    placeholder="输入标签后按回车"
                    value={textTagInput}
                    onChange={(e) => setTextTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTextTag();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={handleAddTextTag}>
                    添加
                  </Button>
                </div>
                {textTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {textTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => handleRemoveTextTag(tag)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* 内容编辑器 */}
              <div className="space-y-2">
                <Label>内容</Label>
                <Tabs defaultValue="edit" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="edit">编辑</TabsTrigger>
                    <TabsTrigger value="preview">预览</TabsTrigger>
                  </TabsList>
                  <TabsContent value="edit" className="mt-2">
                    <Textarea
                      placeholder={
                        textFormat === "markdown"
                          ? "支持 Markdown 语法...\n\n# 标题\n\n**粗体** *斜体*\n\n- 列表项"
                          : "输入文本内容..."
                      }
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      className="min-h-[300px] font-mono text-sm"
                    />
                  </TabsContent>
                  <TabsContent value="preview" className="mt-2">
                    <div className="min-h-[300px] border rounded-md p-4 bg-muted/30 overflow-auto">
                      {textFormat === "markdown" ? (
                        <MarkdownRenderer content={textContent || "*暂无内容*"} />
                      ) : (
                        <pre className="whitespace-pre-wrap text-sm">
                          {textContent || "暂无内容"}
                        </pre>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </ScrollArea>

          {/* 底部操作栏 */}
          <div className="border-t p-4 flex justify-end gap-2">
            <Button variant="outline" onClick={onBack}>
              取消
            </Button>
            <Button onClick={handleTextSubmit} disabled={isSubmitting}>
              {isSubmitting ? "创建中..." : "创建"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* 积分购买对话框 */}
      <PurchaseDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
      />
    </div>
  );
}

