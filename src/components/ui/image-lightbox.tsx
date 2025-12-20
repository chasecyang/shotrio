"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ZoomIn, ZoomOut, RotateCcw, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ImageLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
  downloadFilename?: string;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.5;

export function ImageLightbox({
  open,
  onOpenChange,
  src,
  alt,
  downloadFilename,
}: ImageLightboxProps) {
  const [scale, setScale] = React.useState(1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [open]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + ZOOM_STEP, MAX_SCALE));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - ZOOM_STEP, MIN_SCALE));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setScale((prev) => Math.min(Math.max(prev + delta, MIN_SCALE), MAX_SCALE));
  };

  const handleDoubleClick = () => {
    if (scale === 1) {
      setScale(2);
    } else {
      handleReset();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFilename || `image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
      // Fallback: open in new tab
      window.open(src, "_blank");
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-[100] flex items-center justify-center",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
          onPointerDownOutside={(e) => {
            // Prevent closing when clicking on the image
            if ((e.target as HTMLElement).tagName === "IMG") {
              e.preventDefault();
            }
          }}
        >
          {/* Toolbar */}
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[101] flex items-center gap-1 p-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 shadow-2xl">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-white/80 hover:text-white hover:bg-white/10"
              onClick={handleZoomOut}
              disabled={scale <= MIN_SCALE}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <div className="px-2 min-w-[60px] text-center text-sm font-medium text-white/80">
              {Math.round(scale * 100)}%
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-white/80 hover:text-white hover:bg-white/10"
              onClick={handleZoomIn}
              disabled={scale >= MAX_SCALE}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <div className="w-px h-5 bg-white/20 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-white/80 hover:text-white hover:bg-white/10"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-white/80 hover:text-white hover:bg-white/10"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>

          {/* Close button */}
          <DialogPrimitive.Close
            className={cn(
              "fixed top-4 right-4 z-[101]",
              "h-10 w-10 rounded-full flex items-center justify-center",
              "bg-black/60 backdrop-blur-md border border-white/10",
              "text-white/80 hover:text-white hover:bg-white/10",
              "transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
            )}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">关闭</span>
          </DialogPrimitive.Close>

          {/* Image container */}
          <div
            ref={containerRef}
            className={cn(
              "relative w-full h-full flex items-center justify-center overflow-hidden",
              scale > 1 ? "cursor-grab" : "cursor-zoom-in",
              isDragging && "cursor-grabbing"
            )}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-w-[90vw] max-h-[85vh] object-contain select-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transition: isDragging ? "none" : "transform 0.2s ease-out",
              }}
              draggable={false}
            />
          </div>

          {/* Hint text */}
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[101] text-sm text-white/50">
            双击放大 · 滚轮缩放 · 拖拽平移 · ESC 关闭
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

