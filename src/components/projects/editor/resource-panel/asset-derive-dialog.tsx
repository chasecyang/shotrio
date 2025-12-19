"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Copy, Sparkles } from "lucide-react";
import { AssetWithTags, DerivationType } from "@/types/asset";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface AssetDeriveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceAsset: AssetWithTags | null;
  onSuccess?: () => void;
}

export function AssetDeriveDialog({
  open,
  onOpenChange,
  sourceAsset,
  onSuccess,
}: AssetDeriveDialogProps) {
  const [derivationType, setDerivationType] = useState<DerivationType>("img2img");
  const [assetName, setAssetName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [strength, setStrength] = useState([0.7]);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!sourceAsset) return null;

  const derivationTypeOptions = [
    { value: "img2img", label: "图生图", description: "基于原图生成变体" },
    { value: "inpaint", label: "局部重绘", description: "修改图片的局部区域" },
    { value: "edit", label: "编辑", description: "根据提示词编辑图片" },
    { value: "remix", label: "混合", description: "混合多个图片元素" },
  ];

  const handleDerive = async () => {
    if (!assetName.trim()) {
      toast.error("请输入派生素材名称");
      return;
    }

    if (!prompt.trim()) {
      toast.error("请输入提示词");
      return;
    }

    setIsProcessing(true);
    try {
      // TODO: 调用实际的派生生成 API
      // 这里需要根据实际的图像生成服务来实现
      toast.info("派生功能开发中，敬请期待");
      
      // 模拟处理延迟
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success("派生请求已提交");
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("派生失败:", error);
      toast.error(error instanceof Error ? error.message : "派生失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setDerivationType("img2img");
    setAssetName(`${sourceAsset.name} - 派生`);
    setPrompt(sourceAsset.prompt || "");
    setStrength([0.7]);
  };

  // 当源素材改变时重置表单
  useState(() => {
    if (sourceAsset) {
      setAssetName(`${sourceAsset.name} - 派生`);
      setPrompt(sourceAsset.prompt || "");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            派生新素材
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 源素材展示 */}
          <div className="rounded-lg border p-3 bg-muted/30">
            <Label className="text-xs text-muted-foreground mb-2 block">
              源素材
            </Label>
            <div className="flex items-center gap-3">
              <div className="relative w-20 h-20 rounded-md overflow-hidden bg-muted shrink-0">
                <Image
                  src={sourceAsset.thumbnailUrl || sourceAsset.imageUrl}
                  alt={sourceAsset.name}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{sourceAsset.name}</p>
                {sourceAsset.prompt && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {sourceAsset.prompt}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 派生类型 */}
          <div className="space-y-2">
            <Label>派生类型</Label>
            <Select
              value={derivationType}
              onValueChange={(value) => setDerivationType(value as DerivationType)}
              disabled={isProcessing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {derivationTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {option.description}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 素材名称 */}
          <div className="space-y-2">
            <Label htmlFor="asset-name">派生素材名称</Label>
            <Input
              id="asset-name"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="输入派生素材名称"
              disabled={isProcessing}
            />
          </div>

          {/* 提示词 */}
          <div className="space-y-2">
            <Label htmlFor="prompt">提示词</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你想要的图片内容..."
              rows={4}
              disabled={isProcessing}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              基于源素材的提示词修改，或者输入全新的提示词
            </p>
          </div>

          {/* 派生强度 */}
          {(derivationType === "img2img" || derivationType === "edit") && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>派生强度</Label>
                <Badge variant="secondary" className="text-xs font-mono">
                  {strength[0].toFixed(2)}
                </Badge>
              </div>
              <Slider
                value={strength}
                onValueChange={setStrength}
                min={0.1}
                max={1.0}
                step={0.05}
                disabled={isProcessing}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>保持原图 (0.1)</span>
                <span>完全重绘 (1.0)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                较低的值会保留更多原图特征，较高的值会生成更多变化
              </p>
            </div>
          )}

          {/* 提示信息 */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">提示</p>
                <p>
                  派生功能将使用 AI 生成服务创建新的素材变体。
                  生成过程可能需要一些时间，请在任务中心查看进度。
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            取消
          </Button>
          <Button
            onClick={handleDerive}
            disabled={isProcessing || !assetName.trim() || !prompt.trim()}
          >
            {isProcessing ? "处理中..." : "开始派生"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

