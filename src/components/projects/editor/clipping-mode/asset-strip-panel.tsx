"use client";

import { useState, useEffect } from "react";
import { useEditor } from "../editor-context";
import { queryAssets } from "@/lib/actions/asset";
import { AssetWithFullData } from "@/types/asset";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TrackConfig } from "@/types/timeline";
import { AssetThumbnailItem } from "./asset-thumbnail-item";
import { AssetStripDragPreview } from "./asset-strip-drag-preview";
import { useTimelineDrag } from "./timeline-drag-context";

const EXPANDED_KEY = "timeline:assetStrip:expanded";

interface AssetStripPanelProps {
  projectId: string;
  onAssetDrop: (assetId: string, trackIndex: number, startTime: number) => Promise<void>;
  tracks: TrackConfig[];
}

/**
 * 时间轴内嵌素材条 - 横向显示素材缩略图，支持拖拽到轨道
 */
export function AssetStripPanel({
  projectId,
  onAssetDrop,
  tracks,
}: AssetStripPanelProps) {
  const { state } = useEditor();
  const { project } = state;
  const { draggedAsset, dragPreviewPosition } = useTimelineDrag();

  // 展开/收起状态（持久化到 localStorage）
  const [isExpanded, setIsExpanded] = useState(true);
  const [assets, setAssets] = useState<AssetWithFullData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 从 localStorage 恢复展开状态
  useEffect(() => {
    try {
      const saved = localStorage.getItem(EXPANDED_KEY);
      if (saved !== null) {
        setIsExpanded(saved === "true");
      }
    } catch (error) {
      console.error("读取素材条状态失败:", error);
    }
  }, []);

  // 保存展开状态到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_KEY, String(isExpanded));
    } catch (error) {
      console.error("保存素材条状态失败:", error);
    }
  }, [isExpanded]);

  // 加载项目素材
  useEffect(() => {
    if (!project?.id) return;

    const loadAssets = async () => {
      setIsLoading(true);
      try {
        const result = await queryAssets({
          projectId: project.id,
          limit: 100,
        });
        setAssets(result.assets);
      } catch (error) {
        console.error("加载素材失败:", error);
        toast.error("加载素材失败");
      } finally {
        setIsLoading(false);
      }
    };

    loadAssets();
  }, [project?.id]);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className="border-b bg-muted/30"
    >
      {/* 收起状态的标题栏 */}
      {!isExpanded && (
        <div className="h-7 flex items-center justify-between px-4">
          <span className="text-xs text-muted-foreground">素材</span>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
              <ChevronDown className="h-3 w-3" />
            </Button>
          </CollapsibleTrigger>
        </div>
      )}

      {/* 展开状态的内容 */}
      <CollapsibleContent>
        <div className="flex items-center gap-2 px-4 py-3">
          {/* 标题 */}
          <span className="text-xs text-muted-foreground shrink-0">素材库</span>

          {/* 素材列表 */}
          {isLoading ? (
            <div className="flex gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="w-14 h-14 rounded-lg shrink-0" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="flex items-center justify-center flex-1 py-2 text-xs text-muted-foreground">
              <PackageOpen className="h-4 w-4 mr-2" />
              暂无素材，请先在素材管理中添加
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="flex gap-2 pb-2">
                {assets.map((asset) => (
                  <AssetThumbnailItem key={asset.id} asset={asset} />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}

          {/* 折叠按钮 */}
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
              <ChevronUp className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
        </div>
      </CollapsibleContent>

      {/* 拖拽预览 */}
      <AssetStripDragPreview asset={draggedAsset} position={dragPreviewPosition} />
    </Collapsible>
  );
}
