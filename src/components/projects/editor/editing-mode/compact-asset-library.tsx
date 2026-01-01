"use client";

import { useState, useEffect, useCallback } from "react";
import { useEditor } from "../editor-context";
import { queryAssets } from "@/lib/actions/asset";
import { AssetWithRuntimeStatus } from "@/types/asset";
import { toast } from "sonner";
import { Video, Play } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import { AssetProgressOverlay } from "../shared/asset-progress-overlay";
import { isAssetGenerating, isAssetFailed } from "@/lib/utils/asset-status";

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

  // 监听素材创建事件（用于手动上传素材或作为兜底刷新机制）
  // 注意：Agent生成素材的刷新由 useTaskRefresh 统一处理
  useEffect(() => {
    const handleAssetCreated = () => {
      loadAssets();
    };

    window.addEventListener("asset-created", handleAssetCreated);
    return () => {
      window.removeEventListener("asset-created", handleAssetCreated);
    };
  }, [loadAssets]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">素材</h3>
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
              {assets.map((asset) => {
                const generating = isAssetGenerating(asset);
                const failed = isAssetFailed(asset);
                const isVideo = asset.assetType === "video";
                const displayUrl = isVideo 
                  ? asset.thumbnailUrl 
                  : asset.thumbnailUrl || asset.imageUrl;
                
                return (
                  <div
                    key={asset.id}
                    className="rounded-lg border bg-card overflow-hidden transition-all hover:border-primary/40"
                  >
                    {/* 缩略图 */}
                    <div className="relative aspect-video bg-muted">
                      {generating ? (
                        // 生成中状态 - 显示骨架屏和进度覆盖层
                        <>
                          <Skeleton className="absolute inset-0" />
                          <AssetProgressOverlay job={asset.latestJob} asset={asset} />
                        </>
                      ) : failed ? (
                        // 失败状态 - 显示失败覆盖层
                        <>
                          <div className="absolute inset-0 bg-muted/50" />
                          <AssetProgressOverlay asset={asset} job={asset.latestJob} />
                        </>
                      ) : displayUrl ? (
                        <>
                          <Image
                            src={displayUrl}
                            alt={asset.name}
                            fill
                            className="object-cover"
                          />
                          {/* 视频播放图标 */}
                          {isVideo && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <div className="bg-black/50 rounded-full p-2 backdrop-blur-sm">
                                <Play className="h-4 w-4 text-white fill-white" />
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        // 无缩略图 - 显示默认图标
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* 时长标签 - 只在非生成和非失败状态显示 */}
                      {asset.duration && !generating && !failed && (
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

