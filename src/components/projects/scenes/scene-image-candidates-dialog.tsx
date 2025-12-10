"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface SceneImageCandidatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  images: string[];
  isGenerating: boolean;
  onSelect: (imageUrl: string) => Promise<void>;
}

export function SceneImageCandidatesDialog({
  open,
  onOpenChange,
  title,
  description,
  images,
  isGenerating,
  onSelect,
}: SceneImageCandidatesDialogProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    if (!selectedImage) return;
    
    setIsSaving(true);
    try {
      await onSelect(selectedImage);
      setSelectedImage(null);
      onOpenChange(false);
    } catch (error) {
      console.error("保存失败:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {isGenerating ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 text-muted-foreground py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-lg">AI 正在生成图片，预计需要 30 秒...</p>
              </div>
              
              {/* 骨架屏 */}
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton 
                    key={i} 
                    className="aspect-video rounded-lg animate-pulse"
                    style={{ animationDelay: `${i * 100}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : images.length > 0 ? (
            <>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  请选择一张最合适的图片（点击图片选中）
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {images.map((url, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "aspect-video rounded-lg overflow-hidden cursor-pointer border-4 transition-all duration-200 relative group",
                        selectedImage === url
                          ? "border-primary ring-4 ring-primary/30 scale-[0.98]"
                          : "border-transparent hover:border-primary/50 hover:scale-[0.98]"
                      )}
                      onClick={() => setSelectedImage(url)}
                      style={{
                        animationDelay: `${idx * 100}ms`,
                      }}
                    >
                      <img
                        src={url}
                        alt={`候选 ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* 选中指示器 */}
                      {selectedImage === url && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center animate-in fade-in zoom-in duration-200">
                          <div className="bg-primary rounded-full p-3 shadow-lg">
                            <Check className="w-8 h-8 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                      
                      {/* 编号 */}
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                        #{idx + 1}
                      </div>
                      
                      {/* Hover 提示 */}
                      {selectedImage !== url && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="text-white text-sm font-medium bg-black/60 px-4 py-2 rounded-full backdrop-blur-sm">
                            点击选择
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 确认按钮 */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedImage(null);
                    onOpenChange(false);
                  }}
                  disabled={isSaving}
                >
                  取消
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!selectedImage || isSaving}
                  className="min-w-[120px]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      确认选择
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>暂无候选图片</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

