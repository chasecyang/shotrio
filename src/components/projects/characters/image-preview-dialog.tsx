"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";
import { CharacterImage, SceneImage } from "@/types/project";

interface ImagePreviewDialogProps {
  image: CharacterImage | SceneImage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImagePreviewDialog({
  image,
  open,
  onOpenChange,
}: ImagePreviewDialogProps) {
  if (!image) return null;

  const handleDownload = () => {
    if (!image.imageUrl) return;
    
    // 获取文件名
    const fileName = "label" in image ? image.label : image.imageType;
    
    // 创建一个隐藏的 a 标签来触发下载
    const link = document.createElement("a");
    link.href = image.imageUrl;
    link.download = `${fileName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0">
        <div className="relative">
          <img
            src={image.imageUrl || ""}
            alt={"label" in image ? image.label : image.imageType}
            className="w-full h-auto max-h-[85vh] object-contain"
          />
          <div className="absolute top-4 right-4 flex gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={handleDownload}
              className="h-9 w-9 rounded-full shadow-lg"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 rounded-full shadow-lg"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
            <h3 className="text-white text-xl font-semibold mb-1">
              {"label" in image ? image.label : image.imageType}
            </h3>
            {image.imagePrompt && (
              <p className="text-white/80 text-sm">{image.imagePrompt}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

