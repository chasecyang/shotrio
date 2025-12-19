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
} from "lucide-react";
import { generateAssetImage, editAssetImage } from "@/lib/actions/asset/generate-asset";
import type { ImageResolution } from "@/types/asset";
import type { AspectRatio } from "@/lib/services/fal.service";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { uploadAsset } from "@/lib/actions/asset/upload-asset";
import { useTaskPolling } from "@/hooks/use-task-polling";
import type { Job, AssetImageGenerationResult } from "@/types/job";

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
  } = useEditor();

  const { assetGeneration } = state;

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
  
  // 表单状态（移除assetName）
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [resolution, setResolution] = useState<ImageResolution>("2K");
  const [numImages, setNumImages] = useState(1);

  // 任务状态
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [generatedAssets, setGeneratedAssets] = useState<AssetImageGenerationResult["assets"]>([]);

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
        const result: AssetImageGenerationResult = JSON.parse(currentJob.resultData || "{}");
        setGeneratedAssets(result.assets || []);
        toast.success(`成功生成 ${result.assets?.length || 0} 张图片`);
        
        // 触发素材列表刷新
        window.dispatchEvent(new CustomEvent("asset-created"));
        
        // 清空当前任务ID和上传的图片
        setTimeout(() => {
          setCurrentJobId(null);
          uploadedImages.forEach(img => URL.revokeObjectURL(img.preview));
          setUploadedImages([]);
        }, 2000);
      } catch (error) {
        console.error("解析任务结果失败:", error);
        toast.error("解析结果失败");
      }
    } else if (currentJob.status === "failed") {
      // 任务失败
      toast.error(currentJob.errorMessage || "生成失败");
      setCurrentJobId(null);
    }
  }, [currentJob, uploadedImages]);

  // 智能占位符：根据是否有参考图动态显示
  const placeholder = useMemo(() => {
    const hasImages = uploadedImages.length > 0 || assetGeneration.selectedSourceAssets.length > 0;
    
    if (hasImages) {
      return "基于参考图进行创作，例如：调整为温暖的日落色调，保持人物姿势和表情不变...";
    }
    
    return "详细描述你想要创作的内容，例如：一位30岁的亚洲女性，短发，现代职业装，自信的微笑...";
  }, [uploadedImages.length, assetGeneration.selectedSourceAssets.length]);

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
    setIsDragging(false);
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
      toast.success(`已添加 ${files.length} 张图片`);
    } catch (error) {
      toast.error("添加图片失败");
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

  // 生成图片 - 创建后台任务
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("请输入提示词");
      return;
    }

    setGeneratedAssets([]);

    try {
      let result;
      const hasUploadedImages = uploadedImages.length > 0;
      const hasReference = assetGeneration.selectedSourceAssets.length > 0;
      const hasImages = hasUploadedImages || hasReference;

      // 如果有上传的图片，先上传到服务器
      let uploadedAssetIds: string[] = [];
      if (hasUploadedImages) {
        toast.info("正在上传参考图片...");
        for (const img of uploadedImages) {
          const uploadResult = await uploadAsset({
            projectId,
            userId: state.project?.userId || '',
            assetName: `ref_${Date.now()}`,
            assetType: 'reference',
            file: img.file,
          });
          
          if (uploadResult.success && uploadResult.assetId) {
            uploadedAssetIds.push(uploadResult.assetId);
          }
        }
      }

      // 合并所有参考图的ID
      const allReferenceIds = [...uploadedAssetIds, ...assetGeneration.selectedSourceAssets];

      if (hasImages && allReferenceIds.length > 0) {
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
        // 文生图模式
        result = await generateAssetImage({
          projectId,
          prompt: prompt.trim(),
          assetType: "reference",
          aspectRatio,
          resolution,
          numImages,
        });
      }

      if (result.success && result.jobId) {
        setCurrentJobId(result.jobId);
        toast.success("任务已创建，AI正在处理中...");
        
        // 立即刷新任务列表
        refreshJobs();
      } else {
        toast.error(result.error || "创建任务失败");
      }
    } catch (error) {
      console.error("创建任务失败:", error);
      toast.error("创建任务失败");
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
  ]);

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* 标题栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">AI 素材生成</h2>
          </div>
          <Badge variant="outline" className="text-xs">Nano Banana</Badge>
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
              onClick={() => !isGenerating && !isUploading && fileInputRef.current?.click()}
              className={cn(
                "relative border-b bg-muted/20 cursor-pointer transition-all",
                uploadedImages.length === 0 ? "min-h-[240px]" : "min-h-[160px]",
                isDragging && "border-primary bg-primary/5",
                (isGenerating || isUploading) && "cursor-not-allowed opacity-60"
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

              {uploadedImages.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-background border flex items-center justify-center">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      拖拽图片到此处，或点击上传
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      没有图片？我们将根据你的提示词生成
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex flex-wrap gap-3">
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
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
                      <Image
                        src={asset.imageUrl}
                        alt={asset.name}
                        fill
                        className="object-cover"
                      />
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
    </ScrollArea>
  );
}

