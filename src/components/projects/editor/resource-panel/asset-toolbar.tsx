"use client";

import { Button } from "@/components/ui/button";
import { Grid3x3, List, Upload, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { TagFilter } from "./tag-filter";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AssetToolbarProps {
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: { tagValue: string; count: number }[];
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
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {/* 左侧：视图切换 + 筛选 */}
      <div className="flex items-center gap-2 min-w-0">
        {/* 视图切换 */}
        <div className="flex items-center rounded-lg border p-0.5 shrink-0">
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

      {/* 右侧：AI 创作 + 上传按钮 - 使用 ml-auto 推到右侧 */}
      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              onClick={onOpenAssetGeneration} 
              size="sm" 
              variant="default"
              className="h-8 w-8 p-0"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>AI 创作</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              onClick={onUpload} 
              size="sm" 
              variant="outline"
              className="h-8 w-8 p-0"
            >
              <Upload className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>上传</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

