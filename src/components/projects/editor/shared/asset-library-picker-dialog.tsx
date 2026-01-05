"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check, Search, ImageIcon } from "lucide-react";
import { queryAssets } from "@/lib/actions/asset";
import type { AssetWithFullData } from "@/types/asset";
import { isAssetReady } from "@/lib/utils/asset-status";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface AssetLibraryPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  selectedAssetIds: string[];
  onConfirm: (assetIds: string[]) => void;
  maxSelection?: number;
  title?: string;
  description?: string;
}

export function AssetLibraryPickerDialog({
  open,
  onOpenChange,
  projectId,
  selectedAssetIds,
  onConfirm,
  maxSelection = 10,
  title = "选择素材库图片",
  description = "从素材库中选择图片作为参考",
}: AssetLibraryPickerDialogProps) {
  const [assets, setAssets] = useState<AssetWithFullData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([]);

  // 加载素材库图片
  useEffect(() => {
    if (!open) return;

    const loadAssets = async () => {
      setIsLoading(true);
      try {
        const result = await queryAssets({
          projectId,
          limit: 100,
          search: searchQuery || undefined,
        });
        
        // 只显示图片类型的素材
        const imageAssets = result.assets.filter(
          (asset) => asset.assetType === "image"
        );
        setAssets(imageAssets);
      } catch (error) {
        console.error("加载素材失败:", error);
        toast.error("加载素材失败");
      } finally {
        setIsLoading(false);
      }
    };

    loadAssets();
  }, [open, projectId, searchQuery]);

  // 初始化临时选中状态
  useEffect(() => {
    if (open) {
      setTempSelectedIds(selectedAssetIds);
    }
  }, [open, selectedAssetIds]);

  // 切换选中状态
  const toggleAsset = (assetId: string) => {
    if (tempSelectedIds.includes(assetId)) {
      setTempSelectedIds(tempSelectedIds.filter((id) => id !== assetId));
    } else {
      if (tempSelectedIds.length >= maxSelection) {
        toast.warning(`最多只能选择 ${maxSelection} 张图片`);
        return;
      }
      setTempSelectedIds([...tempSelectedIds, assetId]);
    }
  };

  // 确认选择
  const handleConfirm = () => {
    onConfirm(tempSelectedIds);
    onOpenChange(false);
  };

  // 筛选后的素材
  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return assets;
    
    const query = searchQuery.toLowerCase();
    return assets.filter(
      (asset) =>
        asset.name.toLowerCase().includes(query) ||
        asset.tags.some((tag) => tag.tagValue.toLowerCase().includes(query))
    );
  }, [assets, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {/* 搜索栏 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索素材名称或标签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Badge variant="secondary">
              已选 {tempSelectedIds.length}/{maxSelection}
            </Badge>
          </div>

          {/* 素材网格 */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4">
                  <ImageIcon className="w-8 h-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "未找到匹配的素材" : "暂无图片素材"}
                </p>
                {!searchQuery && (
                  <p className="text-xs text-muted-foreground mt-2">
                    请先在素材库中创建一些图片素材
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3 pb-4">
                {filteredAssets.map((asset) => {
                  const isSelected = tempSelectedIds.includes(asset.id);
                  return (
                    <button
                      key={asset.id}
                      onClick={() => toggleAsset(asset.id)}
                      disabled={!isAssetReady(asset)}
                      className={cn(
                        "relative group aspect-square rounded-lg overflow-hidden",
                        "border-2 transition-all",
                        isSelected
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-transparent hover:border-muted-foreground/20",
                        !isAssetReady(asset) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {asset.displayUrl ? (
                        <Image
                          src={asset.displayUrl}
                          alt={asset.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-muted/50 flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}

                      {/* 选中标记 */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                          <Check className="h-4 w-4" />
                        </div>
                      )}

                      {/* 名称 */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-xs text-white truncate">
                          {asset.name}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* 底部操作栏 */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={tempSelectedIds.length === 0}
          >
            确认选择 ({tempSelectedIds.length})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

