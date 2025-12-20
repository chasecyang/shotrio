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
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { uploadAsset } from "@/lib/actions/asset";
import Image from "next/image";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [assetName, setAssetName] = useState("");
  const [selectedTag, setSelectedTag] = useState("参考");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    // 验证文件类型
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }

    // 验证文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("文件大小不能超过 10MB");
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
      toast.error("请选择文件");
      return;
    }

    if (!assetName.trim()) {
      toast.error("请输入素材名称");
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
        throw new Error(result.error || "上传失败");
      }

      setUploadProgress(100);
      toast.success("素材上传成功");

      // 重置状态
      handleRemoveFile();
      setSelectedTag("参考");
      onOpenChange(false);

      // 触发素材列表刷新事件
      window.dispatchEvent(new CustomEvent("asset-created"));

      // 调用成功回调
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("上传素材失败:", error);
      toast.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const tagOptions = [
    { value: "角色", label: "角色" },
    { value: "场景", label: "场景" },
    { value: "道具", label: "道具" },
    { value: "分镜", label: "分镜" },
    { value: "特效", label: "特效" },
    { value: "参考", label: "参考" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>上传素材</DialogTitle>
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
                  点击或拖拽文件到此处上传
                </p>
                <p className="text-xs text-muted-foreground">
                  支持 JPG、PNG、WebP、GIF，最大 10MB
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
                  alt="预览"
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
                <Label htmlFor="asset-name">素材名称</Label>
                <Input
                  id="asset-name"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="输入素材名称"
                  disabled={isUploading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="asset-tag">素材类型</Label>
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
                    <span className="text-muted-foreground">上传进度</span>
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
            取消
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading || !assetName.trim()}
          >
            {isUploading ? "上传中..." : "上传"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

