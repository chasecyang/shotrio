"use client";

import { useState, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { uploadAsset } from "@/lib/actions/asset";
import Image from "next/image";
import { useTranslations } from "next-intl";

interface AssetUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  userId: string;
  onSuccess?: () => void;
}

export function AssetUploadDialog({
  open,
  onOpenChange,
  projectId,
  userId,
  onSuccess,
}: AssetUploadDialogProps) {
  const t = useTranslations("editor.resource.upload");
  const tToast = useTranslations("toasts");
  const tAsset = useTranslations("projects.assets.types");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [assetName, setAssetName] = useState("");
  const [selectedTag, setSelectedTag] = useState("reference");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    // 验证文件类型
    if (!file.type.startsWith("image/")) {
      toast.error(tToast("error.selectImageFile"));
      return;
    }

    // 验证文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("error"));
      return;
    }

    setSelectedFile(file);
    // 生成预览URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    // 自动填充名称（去掉扩展名）
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    setAssetName(nameWithoutExt);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setAssetName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error(tToast("error.selectFile"));
      return;
    }

    if (!assetName.trim()) {
      toast.error(tToast("error.enterAssetName"));
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // 调用 Server Action 上传文件
      const result = await uploadAsset({
        projectId,
        userId,
        assetName: assetName.trim(),
        tags: [selectedTag],
        file: selectedFile,
      });

      clearInterval(progressInterval);

      if (!result.success) {
        throw new Error(result.error || t("error"));
      }

      setUploadProgress(100);
      toast.success(t("success"));

      // 重置状态
      handleRemoveFile();
      setSelectedTag("reference");
      onOpenChange(false);

      // 触发素材列表刷新事件
      window.dispatchEvent(new CustomEvent("asset-created"));

      // 调用成功回调
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("上传素材失败:", error);
      toast.error(error instanceof Error ? error.message : t("error"));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const tagOptions = [
    { value: "character", label: tAsset("character") },
    { value: "scene", label: tAsset("scene") },
    { value: "prop", label: tAsset("prop") },
    { value: "effect", label: tAsset("effect") },
    { value: "reference", label: tAsset("reference") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 文件选择区域 */}
          {!selectedFile ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                "hover:border-primary hover:bg-accent/50",
                "flex flex-col items-center justify-center gap-3"
              )}
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium mb-1">
                  {t("dragHint")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("fileInfo")}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>
          ) : (
            <div className="relative rounded-xl border overflow-hidden">
              <div className="relative aspect-video bg-muted">
                <Image
                  src={previewUrl || ""}
                  alt="preview"
                  fill
                  className="object-contain"
                />
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={handleRemoveFile}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="p-3 bg-background/95 backdrop-blur">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          )}

          {/* 素材信息 */}
          {selectedFile && (
            <>
              <div className="space-y-2">
                <Label htmlFor="asset-name">{t("assetName")}</Label>
                <Input
                  id="asset-name"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder={t("assetNamePlaceholder")}
                  disabled={isUploading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="asset-tag">{t("assetType")}</Label>
                <Select
                  value={selectedTag}
                  onValueChange={setSelectedTag}
                  disabled={isUploading}
                >
                  <SelectTrigger id="asset-tag">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tagOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 上传进度 */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("uploadProgress")}</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading || !assetName.trim()}
          >
            {isUploading ? t("uploading") : t("title")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

