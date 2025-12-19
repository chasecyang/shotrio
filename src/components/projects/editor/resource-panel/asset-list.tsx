"use client";

import { AssetWithTags } from "@/types/asset";
import { AssetCard } from "./asset-card";
import { Images, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AssetListProps {
  assets: AssetWithTags[];
  viewMode: "grid" | "list";
  isLoading?: boolean;
  selectedAssetId?: string | null;
  onEdit: (asset: AssetWithTags) => void;
  onDelete: (asset: AssetWithTags) => void;
  onDerive: (asset: AssetWithTags) => void;
  onClick: (asset: AssetWithTags) => void;
  onUpload: () => void;
}

export function AssetList({
  assets,
  viewMode,
  isLoading = false,
  selectedAssetId,
  onEdit,
  onDelete,
  onDerive,
  onClick,
  onUpload,
}: AssetListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">加载素材中...</p>
        </div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Images className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-base font-medium mb-1">还没有素材</h3>
        <p className="text-sm text-muted-foreground mb-4 text-center">
          上传图片素材来构建您的素材库
        </p>
        <Button onClick={onUpload} size="sm">
          <Upload className="w-4 h-4 mr-1.5" />
          上传素材
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        viewMode === "grid"
          ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
          : "flex flex-col gap-2"
      )}
    >
      {assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          viewMode={viewMode}
          isSelected={selectedAssetId === asset.id}
          onEdit={onEdit}
          onDelete={onDelete}
          onDerive={onDerive}
          onClick={onClick}
        />
      ))}
    </div>
  );
}

