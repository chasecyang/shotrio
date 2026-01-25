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
import { useTranslations } from "next-intl";

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
  const t = useTranslations("toasts");
  const tFrame = useTranslations("frameCapture");
  const tCommon = useTranslations("common");

  // Format timestamp
  const formatTimestamp = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // When dialog opens, capture current frame
  useEffect(() => {
    if (open && videoRef.current) {
      const video = videoRef.current;

      // Ensure video is loaded
      if (video.readyState < 2) {
        toast.error(tFrame("videoNotLoaded"));
        onOpenChange(false);
        return;
      }

      try {
        // Create canvas and capture current frame
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          toast.error(tFrame("canvasError"));
          onOpenChange(false);
          return;
        }

        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to data URL for preview
        const dataUrl = canvas.toDataURL("image/png");
        setPreviewDataUrl(dataUrl);

        // Set default name (including video name)
        const defaultName = `${videoAssetName} - ${tFrame("screenshot")} - ${formatTimestamp(currentTime)}`;
        setFrameName(defaultName);
      } catch (error) {
        console.error("Failed to capture frame:", error);
        toast.error(tFrame("captureFailed"));
        onOpenChange(false);
      }
    }
  }, [open, videoRef, currentTime, videoAssetName, onOpenChange, tFrame]);

  // Handle confirm capture
  const handleConfirm = async () => {
    if (!frameName.trim()) {
      toast.error(tFrame("nameRequired"));
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
        toast.success(t("success.frameCaptured"));
        onSuccess(result.asset);
        onOpenChange(false);
      } else {
        toast.error(result.error || tFrame("captureFailed"));
      }
    } catch (error) {
      console.error("Failed to capture frame:", error);
      toast.error(tFrame("captureFailedRetry"));
    } finally {
      setIsCapturing(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tFrame("title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview frame */}
          <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
            {previewDataUrl ? (
              <img
                src={previewDataUrl}
                alt={tCommon("preview")}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Timestamp display */}
          <div className="text-sm text-muted-foreground">
            {tFrame("timestamp")}: {formatTimestamp(currentTime)}
          </div>

          {/* Name input */}
          <div className="space-y-2">
            <Label htmlFor="frame-name">{tFrame("frameName")}</Label>
            <Input
              id="frame-name"
              value={frameName}
              onChange={(e) => setFrameName(e.target.value)}
              placeholder={tFrame("frameNamePlaceholder")}
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
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isCapturing || !frameName.trim()}
          >
            {isCapturing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tFrame("confirmCapture")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
