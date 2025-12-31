"use client";

import { useState, useEffect, useCallback } from "react";
import { useEditor } from "../editor-context";
import { queryAssets } from "@/lib/actions/asset";
import { AssetWithRuntimeStatus } from "@/types/asset";
import { toast } from "sonner";
import { Video, Filter } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";

/**
 * 紧凑的素材库（列表视图）
 */
export function CompactAssetLibrary() {
  const { state } = useEditor();
  const { project } = state;
  
  const [assets, setAssets] = useState<AssetWithRuntimeStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "video">("video");

  // 加载素材
  const loadAssets = useCallback(async () => {
    if (!project?.id) return;

    setIsLoading(true);
    try {
      const result = await queryAssets({
        projectId: project.id,
        limit: 100,
      });
      
      // 筛选视频素材
      const filteredAssets = filterType === "video" 
        ? result.assets.filter(asset => asset.assetType === "video")
        : result.assets;
      
      setAssets(filteredAssets);
    } catch (error) {
      console.error("加载素材失败:", error);
      toast.error("加载素材失败");
    } finally {
      setIsLoading(false);
    }
  }, [project?.id, filterType]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // 监听素材创建事件
  useEffect(() => {
    const handleAssetCreated = () => {
      loadAssets();
    };

    window.addEventListener("asset-created", handleAssetCreated);
    return () => {
      window.removeEventListener("asset-created", handleAssetCreated);
    };
  }, [loadAssets]);

  const handleDragStart = (e: React.DragEvent, asset: AssetWithRuntimeStatus) => {
    // 设置拖拽数据
    e.dataTransfer.setData("application/json", JSON.stringify({
      assetId: asset.id,
      assetType: asset.assetType,
      duration: asset.duration,
    }));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">素材库</h3>
          <span className="text-xs text-muted-foreground">
            {assets.length} 个
          </span>
        </div>
        <div className="flex gap-1">
          <Button
            variant={filterType === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("all")}
            className="flex-1 h-8 text-xs"
          >
            全部
          </Button>
          <Button
            variant={filterType === "video" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("video")}
            className="flex-1 h-8 text-xs gap-1"
          >
            <Video className="h-3 w-3" />
            视频
          </Button>
        </div>
      </div>

      {/* 素材列表 */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-2 rounded-lg border p-2">
                  <Skeleton className="w-20 h-14 rounded flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Video className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                暂无视频素材
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, asset)}
                  className="group relative rounded-lg border bg-card overflow-hidden cursor-grab active:cursor-grabbing hover:border-primary transition-colors"
                >
                  {/* 缩略图 */}
                  <div className="relative aspect-video bg-muted">
                    {asset.thumbnailUrl || asset.imageUrl ? (
                      <Image
                        src={asset.thumbnailUrl || asset.imageUrl!}
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
                      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs font-medium">
                        {Math.floor(asset.duration / 1000)}s
                      </div>
                    )}
                  </div>

                  {/* 信息 */}
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">
                      {asset.name}
                    </p>
                  </div>

                  {/* 拖拽提示 */}
                  <div className="absolute inset-0 bg-primary/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs text-primary-foreground font-medium">
                      拖入时间轴
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

