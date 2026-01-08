"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryAssets } from "@/lib/actions/asset";
import { AssetWithFullData } from "@/types/asset";
import { isAssetReady } from "@/lib/utils/asset-status";
import Image from "next/image";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface ReferenceAssetSelectorProps {
  projectId: string;
  selectedAssetIds: string[];
  onSelectionChange: (assetIds: string[]) => void;
  maxSelection?: number;
}

export function ReferenceAssetSelector({
  projectId,
  selectedAssetIds,
  onSelectionChange,
  maxSelection = 14,
}: ReferenceAssetSelectorProps) {
  const t = useTranslations("projects.assets");
  const tToast = useTranslations("toasts");
  const [assets, setAssets] = useState<AssetWithFullData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // 加载素材
  useEffect(() => {
    async function loadAssets() {
      setIsLoading(true);
      try {
        const result = await queryAssets({
          projectId,
          limit: 100,
        });
        setAssets(result.assets);
      } catch (error) {
        console.error("Failed to load assets:", error);
        toast.error(tToast("error.loadAssetFailed"));
      } finally {
        setIsLoading(false);
      }
    }

    loadAssets();
  }, [projectId]);

  // 筛选素材
  const filteredAssets = assets.filter((asset) => {
    if (!searchQuery) return true;
    return asset.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // 切换选择
  const toggleAsset = (assetId: string) => {
    if (selectedAssetIds.includes(assetId)) {
      onSelectionChange(selectedAssetIds.filter((id) => id !== assetId));
    } else {
      if (selectedAssetIds.length >= maxSelection) {
        toast.error(t("selected", { current: maxSelection, max: maxSelection }));
        return;
      }
      onSelectionChange([...selectedAssetIds, assetId]);
    }
  };

  // 清除所有选择
  const clearSelection = () => {
    onSelectionChange([]);
  };

  return (
    <div className="space-y-3">
      {/* 顶部操作栏 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Badge variant="secondary">
          {selectedAssetIds.length}/{maxSelection}
        </Badge>
        {selectedAssetIds.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            <X className="h-4 w-4 mr-1" />
            {t("clear")}
          </Button>
        )}
      </div>

      {/* 素材网格 */}
      <ScrollArea className="h-[400px]">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? t("noMatch") : t("empty")}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filteredAssets.map((asset) => {
              const isSelected = selectedAssetIds.includes(asset.id);
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
                    <Skeleton className="absolute inset-0" />
                  )}
                  
                  {/* 选中标记 */}
                  {isSelected && (
                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-1">
                      <Check className="h-3 w-3" />
                    </div>
                  )}

                  {/* 名称 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-xs text-white truncate">{asset.name}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

