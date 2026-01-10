"use client";

import { useState, useEffect } from "react";
import { useEditor } from "../editor-context";
import { queryAssets } from "@/lib/actions/asset";
import { AssetWithFullData } from "@/types/asset";
import { toast } from "sonner";
import { Video } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";

interface AddAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: AssetWithFullData) => void;
}

/**
 * 添加素材对话框 - 选择视频素材添加到时间轴
 */
export function AddAssetDialog({ open, onOpenChange, onSelect }: AddAssetDialogProps) {
  const { state } = useEditor();
  const { project } = state;
  
  const [assets, setAssets] = useState<AssetWithFullData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 加载视频素材
  useEffect(() => {
    if (!open || !project?.id) return;

    const loadAssets = async () => {
      setIsLoading(true);
      try {
        const result = await queryAssets({
          projectId: project.id,
          limit: 100,
        });
        
        // 只显示视频素材
        const videoAssets = result.assets.filter(asset => asset.assetType === "video");
        setAssets(videoAssets);
      } catch (error) {
        console.error("加载素材失败:", error);
        toast.error("加载素材失败");
      } finally {
        setIsLoading(false);
      }
    };

    loadAssets();
  }, [open, project?.id]);

  const handleSelect = (asset: AssetWithFullData) => {
    onSelect(asset);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>选择视频素材</DialogTitle>
          <DialogDescription>
            选择一个视频素材添加到时间轴
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-video w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Video className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                暂无视频素材
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                请先在素材管理模式中生成或上传视频
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleSelect(asset)}
                  className="group relative rounded-lg border bg-card overflow-hidden hover:border-primary transition-all hover:shadow-md text-left"
                >
                  {/* 缩略图 */}
                  <div className="relative aspect-video bg-muted">
                    {asset.displayUrl ? (
                      <Image
                        src={asset.displayUrl}
                        alt={asset.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* 时长标签 */}
                    {asset.duration && (
                      <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-medium">
                        {Math.floor(asset.duration / 1000)}s
                      </div>
                    )}

                    {/* 悬停遮罩 */}
                    <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-sm text-primary font-medium bg-background/90 px-3 py-1.5 rounded-full">
                        添加到时间轴
                      </span>
                    </div>
                  </div>

                  {/* 信息 */}
                  <div className="p-3">
                    <p className="text-sm font-medium truncate">
                      {asset.name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

