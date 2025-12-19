"use client";

import { Button } from "@/components/ui/button";
import { Grid3x3, List, Upload, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { TagFilter } from "./tag-filter";
import { TagType } from "@/types/asset";

interface TagFilterItem {
  tagType: TagType;
  tagValue: string;
}

interface AssetToolbarProps {
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  selectedTags: TagFilterItem[];
  onTagsChange: (tags: TagFilterItem[]) => void;
  availableTags: { tagType: TagType; tagValue: string; count: number }[];
  onUpload: () => void;
  onOpenAssetGeneration: () => void;
}

export function AssetToolbar({
  viewMode,
  onViewModeChange,
  selectedTags,
  onTagsChange,
  availableTags,
  onUpload,
  onOpenAssetGeneration,
}: AssetToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      {/* 左侧：视图切换 + 筛选 */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* 视图切换 */}
        <div className="flex items-center rounded-lg border p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 w-7 p-0",
              viewMode === "grid" && "bg-accent"
            )}
            onClick={() => onViewModeChange("grid")}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 w-7 p-0",
              viewMode === "list" && "bg-accent"
            )}
            onClick={() => onViewModeChange("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        {/* 标签筛选 */}
        <TagFilter
          selectedTags={selectedTags}
          onChange={onTagsChange}
          availableTags={availableTags}
        />
      </div>

      {/* 右侧：AI 创作 + 上传按钮 */}
      <div className="flex items-center gap-2">
        <Button onClick={onOpenAssetGeneration} size="sm" variant="default">
          <Sparkles className="h-4 w-4 mr-1.5" />
          AI 创作
        </Button>
        <Button onClick={onUpload} size="sm" variant="outline">
          <Upload className="h-4 w-4 mr-1.5" />
          上传
        </Button>
      </div>
    </div>
  );
}

