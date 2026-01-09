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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, X, ImageIcon, Video, Music, FileText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { uploadMediaAsset } from "@/lib/actions/asset/upload-media-asset";
import { uploadTextAsset } from "@/lib/actions/asset/upload-text-asset";
import Image from "next/image";
import { useTranslations } from "next-intl";

interface MediaUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  userId: string;
  onSuccess?: () => void;
}

type MediaType = "image" | "video" | "audio";
type UploadMode = "file" | "text";
type UploadPhase = "idle" | "analyzing" | "uploading";

const MAX_TEXT_LENGTH = 100 * 1024; // 100KB

// 文件大小限制
const SIZE_LIMITS = {
  image: 10 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
};

/**
 * 检测媒体类型
 */
function getMediaType(file: File): MediaType | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function MediaUploadDialog({
  open,
  onOpenChange,
  projectId,
  userId,
  onSuccess,
}: MediaUploadDialogProps) {
  const t = useTranslations("editor.resource.upload");
  const tToast = useTranslations("toasts");

  // 模式切换
  const [uploadMode, setUploadMode] = useState<UploadMode>("file");

  // 文件上传状态
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);

  // 文本输入状态
  const [textContent, setTextContent] = useState("");

  // 共享状态
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    const type = getMediaType(file);
    if (!type) {
      toast.error(t("unsupportedFormat"));
      return;
    }

    // 验证大小
    const sizeLimit = SIZE_LIMITS[type];
    if (file.size > sizeLimit) {
      toast.error(t("fileTooLarge", { size: sizeLimit / 1024 / 1024 }));
      return;
    }

    setSelectedFile(file);
    setMediaType(type);

    // 生成预览 URL
    if (type === "image" || type === "video") {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
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
    setMediaType(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setDescription("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleReset = () => {
    handleRemoveFile();
    setTextContent("");
    setUploadProgress(0);
    setUploadPhase("idle");
  };

  const handleUpload = async () => {
    // 验证输入
    if (uploadMode === "file" && !selectedFile) {
      toast.error(tToast("error.selectFile"));
      return;
    }
    if (uploadMode === "text" && !textContent.trim()) {
      toast.error(t("textContentRequired"));
      return;
    }

    setIsUploading(true);
    setUploadPhase("analyzing");
    setUploadProgress(10);

    try {
      // 模拟进度
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 40) {
            setUploadPhase("uploading");
          }
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 5;
        });
      }, 200);

      let result: { success: boolean; error?: string };

      if (uploadMode === "file") {
        result = await uploadMediaAsset({
          projectId,
          userId,
          file: selectedFile!,
          description: description.trim(),
        });
      } else {
        result = await uploadTextAsset({
          projectId,
          userId,
          textContent: textContent.trim(),
          description: description.trim(),
        });
      }

      clearInterval(progressInterval);

      if (!result.success) {
        throw new Error(result.error || t("error"));
      }

      setUploadProgress(100);
      toast.success(uploadMode === "text" ? t("textSuccess") : t("success"));

      // 重置并关闭
      handleReset();
      onOpenChange(false);

      // 触发素材列表刷新事件
      window.dispatchEvent(new CustomEvent("asset-created"));

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("上传素材失败:", error);
      toast.error(error instanceof Error ? error.message : t("error"));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadPhase("idle");
    }
  };

  const getDescriptionPlaceholder = () => {
    switch (mediaType) {
      case "image":
        return t("descriptionPlaceholderImage");
      case "video":
        return t("descriptionPlaceholderVideo");
      case "audio":
        return t("descriptionPlaceholderAudio");
      default:
        return t("descriptionPlaceholder");
    }
  };

  const getDescriptionHint = () => {
    switch (mediaType) {
      case "image":
        return t("descriptionHintImage");
      case "video":
        return t("descriptionHintVideo");
      case "audio":
        return t("descriptionHintAudio");
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <Tabs
          value={uploadMode}
          onValueChange={(v) => setUploadMode(v as UploadMode)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="file" disabled={isUploading}>
              <Upload className="h-4 w-4 mr-2" />
              {t("fileUpload")}
            </TabsTrigger>
            <TabsTrigger value="text" disabled={isUploading}>
              <FileText className="h-4 w-4 mr-2" />
              {t("textInput")}
            </TabsTrigger>
          </TabsList>

          {/* 文件上传模式 */}
          <TabsContent value="file" className="space-y-4 mt-0">
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
                  <p className="text-sm font-medium mb-1">{t("dragHint")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("fileInfo")}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </div>
            ) : (
              <div className="relative rounded-xl border overflow-hidden">
                {/* 预览区域 */}
                <div className="relative aspect-video bg-muted flex items-center justify-center">
                  {mediaType === "image" && previewUrl && (
                    <Image
                      src={previewUrl}
                      alt="preview"
                      fill
                      className="object-contain"
                    />
                  )}
                  {mediaType === "video" && previewUrl && (
                    <video
                      src={previewUrl}
                      className="w-full h-full object-contain"
                      muted
                    />
                  )}
                  {mediaType === "audio" && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Music className="w-8 h-8 text-primary" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t("audioPreview")}
                      </p>
                    </div>
                  )}
                </div>

                {/* 删除按钮 */}
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handleRemoveFile}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>

                {/* 文件信息 */}
                <div className="p-3 bg-background/95 backdrop-blur flex items-center gap-2">
                  {mediaType === "image" && (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                  {mediaType === "video" && (
                    <Video className="h-4 w-4 text-muted-foreground" />
                  )}
                  {mediaType === "audio" && (
                    <Music className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 文件描述输入 */}
            {selectedFile && !isUploading && (
              <div className="space-y-2">
                <Label htmlFor="description">{t("description")}</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={getDescriptionPlaceholder()}
                  rows={3}
                  maxLength={200}
                  disabled={isUploading}
                />
                <p className="text-xs text-muted-foreground">
                  {getDescriptionHint()}
                </p>
              </div>
            )}
          </TabsContent>

          {/* 文本输入模式 */}
          <TabsContent value="text" className="space-y-4 mt-0">
            {/* 文本内容输入 */}
            <div className="space-y-2">
              <Label htmlFor="textContent">{t("textContent")}</Label>
              <Textarea
                id="textContent"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder={t("textContentPlaceholder")}
                rows={8}
                maxLength={MAX_TEXT_LENGTH}
                disabled={isUploading}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {textContent.length.toLocaleString()} / 100,000 {t("characters")}
              </p>
            </div>

            {/* 文本描述输入 */}
            {!isUploading && (
              <div className="space-y-2">
                <Label htmlFor="textDescription">{t("description")}</Label>
                <Textarea
                  id="textDescription"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("descriptionPlaceholderText")}
                  rows={2}
                  maxLength={200}
                  disabled={isUploading}
                />
                <p className="text-xs text-muted-foreground">
                  {t("descriptionHintText")}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* 上传进度 */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {uploadPhase === "analyzing" ? t("analyzing") : t("uploading")}
              </span>
              <span className="font-medium">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

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
            disabled={
              isUploading ||
              (uploadMode === "file" && !selectedFile) ||
              (uploadMode === "text" && !textContent.trim())
            }
          >
            {isUploading ? t("uploading") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
