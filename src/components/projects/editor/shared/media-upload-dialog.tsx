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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, X, ImageIcon, Video, Music, FileText, CheckCircle, AlertCircle } from "lucide-react";
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

interface FileQueueItem {
  id: string;
  file: File;
  previewUrl: string | null;
  mediaType: MediaType | null;
  description: string;
  status: "pending" | "uploading" | "completed" | "failed";
  progress: number;
  error?: string;
}

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

  // 文件队列状态（替代单文件状态）
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);

  // 文本输入状态
  const [textContent, setTextContent] = useState("");
  const [textDescription, setTextDescription] = useState("");

  // 共享状态
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelect = (files: File[]) => {
    const newItems: FileQueueItem[] = [];

    for (const file of files) {
      const type = getMediaType(file);
      if (!type) {
        toast.error(t("unsupportedFormat", { name: file.name }));
        continue;
      }

      // 验证大小
      const sizeLimit = SIZE_LIMITS[type];
      if (file.size > sizeLimit) {
        toast.error(
          t("fileTooLarge", {
            name: file.name,
            size: sizeLimit / 1024 / 1024,
          })
        );
        continue;
      }

      // 创建文件项
      const id = crypto.randomUUID();
      const previewUrl =
        type === "image" || type === "video"
          ? URL.createObjectURL(file)
          : null;

      // 从文件名提取 description（去掉扩展名）
      const description = file.name.replace(/\.[^/.]+$/, "");

      newItems.push({
        id,
        file,
        previewUrl,
        mediaType: type,
        description,
        status: "pending",
        progress: 0,
      });
    }

    if (newItems.length > 0) {
      setFileQueue((prev) => [...prev, ...newItems]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    handleFilesSelect(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFilesSelect(Array.from(files));
    }
  };

  // 更新单个文件的 description
  const updateItemDescription = (id: string, description: string) => {
    setFileQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, description } : item))
    );
  };

  // 更新单个文件的状态
  const updateItemStatus = (
    id: string,
    status: FileQueueItem["status"],
    error?: string,
    progress?: number
  ) => {
    setFileQueue((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status, error, progress: progress ?? item.progress }
          : item
      )
    );
  };

  // 移除单个文件
  const removeItem = (id: string) => {
    setFileQueue((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  // 重置所有状态
  const handleReset = () => {
    // 清理所有预览 URL
    fileQueue.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setFileQueue([]);
    setTextContent("");
    setTextDescription("");
    setUploadProgress(0);
    setUploadPhase("idle");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    // 验证输入
    if (uploadMode === "file") {
      const pendingItems = fileQueue.filter(
        (item) => item.status === "pending"
      );
      if (pendingItems.length === 0) {
        toast.error(tToast("error.selectFile"));
        return;
      }
    } else if (uploadMode === "text" && !textContent.trim()) {
      toast.error(t("textContentRequired"));
      return;
    }

    setIsUploading(true);

    try {
      if (uploadMode === "file") {
        // 批量上传文件
        const pendingItems = fileQueue.filter(
          (item) => item.status === "pending"
        );
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < pendingItems.length; i++) {
          const item = pendingItems[i];
          updateItemStatus(item.id, "uploading", undefined, 0);
          setUploadPhase("analyzing");

          try {
            // 模拟进度
            let currentProgress = 0;
            const progressInterval = setInterval(() => {
              currentProgress = Math.min(currentProgress + 10, 90);
              updateItemStatus(item.id, "uploading", undefined, currentProgress);
              if (currentProgress >= 40) {
                setUploadPhase("uploading");
              }
            }, 200);

            const result = await uploadMediaAsset({
              projectId,
              userId,
              file: item.file,
              description: item.description.trim(),
            });

            clearInterval(progressInterval);

            if (result.success) {
              updateItemStatus(item.id, "completed", undefined, 100);
              successCount++;
            } else {
              updateItemStatus(
                item.id,
                "failed",
                result.error || t("error")
              );
              failCount++;
            }
          } catch (error) {
            updateItemStatus(
              item.id,
              "failed",
              error instanceof Error ? error.message : t("error")
            );
            failCount++;
          }
        }

        // 显示结果
        if (successCount > 0) {
          toast.success(t("batchSuccess", { count: successCount }));
        }
        if (failCount > 0) {
          toast.error(t("batchFailed", { count: failCount }));
        }

        // 全部成功则关闭对话框
        if (failCount === 0) {
          handleReset();
          onOpenChange(false);
          window.dispatchEvent(new CustomEvent("asset-created"));
          if (onSuccess) onSuccess();
        }
      } else {
        // 文本上传（保持原逻辑）
        setUploadPhase("analyzing");
        setUploadProgress(10);

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

        const result = await uploadTextAsset({
          projectId,
          userId,
          textContent: textContent.trim(),
          description: textDescription.trim(),
        });

        clearInterval(progressInterval);

        if (!result.success) {
          throw new Error(result.error || t("error"));
        }

        setUploadProgress(100);
        toast.success(t("textSuccess"));
        handleReset();
        onOpenChange(false);
        window.dispatchEvent(new CustomEvent("asset-created"));
        if (onSuccess) onSuccess();
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
            {fileQueue.length === 0 ? (
              // 空状态：拖放上传区
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
                  multiple
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </div>
            ) : (
              // 文件列表视图
              <>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {fileQueue.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-start gap-3 p-2 rounded-lg border bg-card transition-colors",
                        item.status === "uploading" && "bg-primary/5",
                        item.status === "completed" && "bg-green-50 dark:bg-green-950/20",
                        item.status === "failed" && "bg-red-50 dark:bg-red-950/20"
                      )}
                    >
                      {/* 缩略图 */}
                      <div className="w-10 h-10 rounded bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {item.mediaType === "image" && item.previewUrl ? (
                          <img
                            src={item.previewUrl}
                            alt="preview"
                            className="w-full h-full object-cover"
                          />
                        ) : item.mediaType === "video" ? (
                          <Video className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <Music className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>

                      {/* 文件信息 + description 输入 */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">
                            {item.file.name}
                          </span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatFileSize(item.file.size)}
                          </span>
                        </div>

                        {item.status === "pending" && !isUploading && (
                          <Input
                            value={item.description}
                            onChange={(e) =>
                              updateItemDescription(item.id, e.target.value)
                            }
                            placeholder={t("descriptionPlaceholder")}
                            className="h-7 text-xs"
                            maxLength={200}
                          />
                        )}

                        {item.status === "uploading" && (
                          <div className="space-y-1">
                            <Progress value={item.progress} className="h-1" />
                            <p className="text-xs text-muted-foreground">
                              {item.progress}%
                            </p>
                          </div>
                        )}

                        {item.status === "completed" && (
                          <span className="text-xs text-green-600 dark:text-green-400">
                            {t("uploadSuccess")}
                          </span>
                        )}

                        {item.status === "failed" && (
                          <span className="text-xs text-red-600 dark:text-red-400">
                            {item.error || t("error")}
                          </span>
                        )}
                      </div>

                      {/* 右侧操作区 */}
                      <div className="flex items-center gap-1">
                        {item.status === "pending" && !isUploading && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeItem(item.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                        {item.status === "completed" && (
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        )}
                        {item.status === "failed" && (
                          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 继续添加文件按钮 */}
                {!isUploading && (
                  <div
                    className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="text-sm text-muted-foreground">
                      {t("addMoreFiles")}
                    </span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </>
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
                  value={textDescription}
                  onChange={(e) => setTextDescription(e.target.value)}
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
              (uploadMode === "file" &&
                fileQueue.filter((item) => item.status === "pending")
                  .length === 0) ||
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
