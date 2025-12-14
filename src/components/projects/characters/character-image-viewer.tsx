"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ZoomIn, ZoomOut, RotateCw, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface CharacterImageViewerProps {
  imageUrl: string;
  imageLabel: string;
  characterName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CharacterImageViewer({
  imageUrl,
  imageLabel,
  characterName,
  open,
  onOpenChange,
}: CharacterImageViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 50));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${characterName}-${imageLabel}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("下载失败:", error);
    }
  };

  const handleReset = () => {
    setZoom(100);
    setRotation(0);
  };

  // 当对话框关闭时重置状态
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      handleReset();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] p-0 flex flex-col gap-0">
        <DialogTitle className="sr-only">
          {characterName} - {imageLabel}
        </DialogTitle>
        
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{characterName}</h2>
            <p className="text-sm text-muted-foreground truncate">{imageLabel}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={zoom <= 50}
              title="缩小"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            
            <div className="min-w-[60px] text-center text-sm font-medium">
              {zoom}%
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              title="放大"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1" />

            <Button
              variant="ghost"
              size="icon"
              onClick={handleRotate}
              title="旋转"
            >
              <RotateCw className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              title="下载"
            >
              <Download className="w-4 h-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1" />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenChange(false)}
              title="关闭"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 图片查看区域 */}
        <div className="flex-1 min-h-0 overflow-auto bg-muted/30 relative">
          <div className="absolute inset-0 flex items-center justify-center p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={`${characterName} - ${imageLabel}`}
              className={cn(
                "max-w-full max-h-full object-contain transition-all duration-200 ease-out",
                "shadow-2xl rounded-lg"
              )}
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              }}
            />
          </div>
        </div>

        {/* 底部提示 */}
        <div className="px-6 py-3 border-t bg-muted/50 text-center">
          <p className="text-xs text-muted-foreground">
            点击图片外区域或按 ESC 键关闭 · 使用工具栏控制缩放和旋转
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

