"use client";

import { useState, useEffect } from "react";
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
import { Copy, Sparkles, Loader2 } from "lucide-react";
import { AssetWithTags, DerivationType } from "@/types/asset";
import { toast } from "sonner";
import Image from "next/image";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("editor.resource.derive");
  const tToast = useTranslations("toasts");
  const [derivationType, setDerivationType] = useState<DerivationType>("img2img");
  const [assetName, setAssetName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [strength, setStrength] = useState([0.7]);
  const [isProcessing, setIsProcessing] = useState(false);

  // 当源素材改变时重置表单 (必须在早期返回之前调用)
  useEffect(() => {
    if (sourceAsset) {
      setAssetName(`${sourceAsset.name}${t("nameSuffix")}`);
      setPrompt(sourceAsset.prompt || "");
    }
  }, [sourceAsset, t]);

  if (!sourceAsset) return null;

  const derivationTypeOptions: Array<{
    value: DerivationType;
    label: string;
    description: string;
  }> = [
    {
      value: "img2img",
      label: t("types.img2img.label"),
      description: t("types.img2img.description"),
    },
    {
      value: "inpaint",
      label: t("types.inpaint.label"),
      description: t("types.inpaint.description"),
    },
    {
      value: "edit",
      label: t("types.edit.label"),
      description: t("types.edit.description"),
    },
    {
      value: "remix",
      label: t("types.remix.label"),
      description: t("types.remix.description"),
    },
  ];

  const handleDerive = async () => {
    if (!assetName.trim()) {
      toast.error(tToast("error.enterDerivationName"));
      return;
    }

    if (!prompt.trim()) {
      toast.error(tToast("error.enterPrompt"));
      return;
    }

    setIsProcessing(true);
    try {
      // TODO: 调用实际的派生生成 API
      // 这里需要根据实际的图像生成服务来实现
      toast.info(tToast("info.derivationInDevelopment"));
      
      // 模拟处理延迟
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success(tToast("success.derivationSubmitted"));
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("派生失败:", error);
      toast.error(error instanceof Error ? error.message : tToast("error.generationFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            {t("title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 源素材展示 */}
          <div className="rounded-lg border p-3 bg-muted/30">
            <Label className="text-xs text-muted-foreground mb-2 block">
              {t("sourceAsset")}
            </Label>
            <div className="flex items-center gap-3">
              <div className="relative w-20 h-20 rounded-md overflow-hidden bg-muted shrink-0">
                {sourceAsset.imageUrl ? (
                  <Image
                    src={sourceAsset.thumbnailUrl || sourceAsset.imageUrl}
                    alt={sourceAsset.name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
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
            <Label>{t("derivationType")}</Label>
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
            <Label htmlFor="asset-name">{t("assetName")}</Label>
            <Input
              id="asset-name"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder={t("assetNamePlaceholder")}
              disabled={isProcessing}
            />
          </div>

          {/* 提示词 */}
          <div className="space-y-2">
            <Label htmlFor="prompt">{t("prompt")}</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("promptPlaceholder")}
              rows={4}
              disabled={isProcessing}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {t("promptHint")}
            </p>
          </div>

          {/* 派生强度 */}
          {(derivationType === "img2img" || derivationType === "edit") && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t("strength")}</Label>
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
                <span>{t("strengthMin")}</span>
                <span>{t("strengthMax")}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("strengthHint")}
              </p>
            </div>
          )}

          {/* 提示信息 */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">{t("hintTitle")}</p>
                <p>
                  {t("hint")}
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
            {t("cancel")}
          </Button>
          <Button
            onClick={handleDerive}
            disabled={isProcessing || !assetName.trim() || !prompt.trim()}
          >
            {isProcessing ? t("deriving") : t("startDerive")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

