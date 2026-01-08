"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssetCard } from "./asset-card";
import { AssetWithFullData } from "@/types/asset";

interface AssetGroupProps {
  title: string;
  count: number;
  assets: AssetWithFullData[];
  defaultExpanded?: boolean;
  selectedAssetIds: Set<string>;
  onAssetClick: (asset: AssetWithFullData) => void;
  onAssetDelete: (asset: AssetWithFullData) => void;
  onSelectChange: (assetId: string, selected: boolean) => void;
  onRegenerate?: (asset: AssetWithFullData) => void;
  onEdit?: (asset: AssetWithFullData) => void;
  onSetActiveVersion?: (assetId: string, versionId: string) => void;
}

export function AssetGroup({
  title,
  count,
  assets,
  defaultExpanded = true,
  selectedAssetIds,
  onAssetClick,
  onAssetDelete,
  onSelectChange,
  onRegenerate,
  onEdit,
  onSetActiveVersion,
}: AssetGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="mb-4">
      {/* 分组标题 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-2 rounded-lg",
          "text-sm font-medium text-foreground/80",
          "hover:bg-muted/50 transition-colors",
          "group"
        )}
      >
        <span className="text-muted-foreground transition-transform duration-200">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
        <span>{title}</span>
        <span className="text-xs text-muted-foreground font-normal">
          ({count})
        </span>
      </button>

      {/* 素材网格 */}
      {expanded && (
        <div
          className="grid gap-3 mt-2 pl-2"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          }}
        >
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              isBatchSelected={selectedAssetIds.has(asset.id)}
              onDelete={onAssetDelete}
              onClick={onAssetClick}
              onSelectChange={onSelectChange}
              onRegenerate={onRegenerate}
              onEdit={onEdit}
              onSetActiveVersion={onSetActiveVersion}
            />
          ))}
        </div>
      )}
    </div>
  );
}
