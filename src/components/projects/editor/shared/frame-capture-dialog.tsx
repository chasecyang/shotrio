"use client";

import { useState, useEffect, useRef, RefObject } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { captureVideoFrame } from "@/lib/actions/asset/capture-video-frame";
import type { AssetWithFullData } from "@/types/asset";

interface FrameCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
  currentTime: number;
  videoAssetId: string;
  videoAssetName: string;
  videoUrl: string;
  projectId: string;
  onSuccess: (asset?: AssetWithFullData) => void;
}

export function FrameCaptureDialog({
  open,
  onOpenChange,
  videoRef,
  currentTime,
  videoAssetId,
  videoAssetName,
  videoUrl,
  projectId,
  onSuccess,
}: FrameCaptureDialogProps) {
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [frameName, setFrameName] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 格式化时间戳
  const formatTimestamp = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 当对话框打开时，捕获当前帧
  useEffect(() => {
    if (open && videoRef.current) {
      const video = videoRef.current;

      // 确保视频已加载
      if (video.readyState < 2) {
        toast.error("视频尚未加载完成");
        onOpenChange(false);
        return;
      }

      try {
        // 创建 canvas 并捕获当前帧
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          toast.error("无法创建画布");
          onOpenChange(false);
          return;
        }

        // 绘制当前视频帧到 canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 转换为 data URL 用于预览
        const dataUrl = canvas.toDataURL("image/png");
        setPreviewDataUrl(dataUrl);

        // 设置默认名称（包含视频名称）
        const defaultName = `${videoAssetName} - 截图 - ${formatTimestamp(currentTime)}`;
        setFrameName(defaultName);
      } catch (error) {
        console.error("捕获帧失败:", error);
        toast.error("捕获画面失败");
        onOpenChange(false);
      }
    }
  }, [open, videoRef, currentTime, videoAssetName, onOpenChange]);

  // 处理确认捕获
  const handleConfirm = async () => {
    if (!frameName.trim()) {
      toast.error("请输入画面名称");
      return;
    }

    setIsCapturing(true);

    try {
      const result = await captureVideoFrame({
        projectId,
        sourceVideoAssetId: videoAssetId,
        videoUrl,
        timestamp: currentTime,
        frameName: frameName.trim(),
      });

      if (result.success) {
        toast.success("画面截取成功");
        onSuccess(result.asset);
        onOpenChange(false);
      } else {
        toast.error(result.error || "画面截取失败");
      }
    } catch (error) {
      console.error("截取画面失败:", error);
      toast.error("画面截取失败，请重试");
    } finally {
      setIsCapturing(false);
    }
  };

  // 处理取消
  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>截取画面</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 预览画面 */}
          <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
            {previewDataUrl ? (
              <img
                src={previewDataUrl}
                alt="预览"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* 时间戳显示 */}
          <div className="text-sm text-muted-foreground">
            时间戳: {formatTimestamp(currentTime)}
          </div>

          {/* 名称输入 */}
          <div className="space-y-2">
            <Label htmlFor="frame-name">画面名称</Label>
            <Input
              id="frame-name"
              value={frameName}
              onChange={(e) => setFrameName(e.target.value)}
              placeholder="输入画面名称"
              disabled={isCapturing}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isCapturing}
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isCapturing || !frameName.trim()}
          >
            {isCapturing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            确认截取
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
