"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Filter, 
  X, 
  Search,
  Image as ImageIcon,
  Video,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetTypeEnum, AssetWithRuntimeStatus } from "@/types/asset";

export interface AssetFilterOptions {
  search?: string;
  assetTypes: AssetTypeEnum[];
  tags: string[];
}

interface AssetFilterProps {
  value: AssetFilterOptions;
  onChange: (value: AssetFilterOptions) => void;
  onReset: () => void;
  allAssets: AssetWithRuntimeStatus[]; // 用于提取标签
}

const assetTypeOptions: { value: AssetTypeEnum; label: string; icon: typeof ImageIcon }[] = [
  { value: "image", label: "图片", icon: ImageIcon },
  { value: "video", label: "视频", icon: Video },
];

export function AssetFilter({ value, onChange, onReset, allAssets }: AssetFilterProps) {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState(value.search || "");

  // 从素材中提取所有标签并统计使用频次
  const tagStats = useMemo(() => {
    const tagCounts = new Map<string, number>();
    
    allAssets.forEach(asset => {
      if (asset.tags && asset.tags.length > 0) {
        asset.tags.forEach(tag => {
          const tagValue = tag.tagValue;
          tagCounts.set(tagValue, (tagCounts.get(tagValue) || 0) + 1);
        });
      }
    });
    
    // 转换为数组并按使用频次降序排序
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [allAssets]);

  // 计算活跃的筛选数量
  const activeFiltersCount = 
    (value.search ? 1 : 0) +
    (value.assetTypes.length > 0 && value.assetTypes.length < 2 ? 1 : 0) +
    value.tags.length;

  // 切换素材类型
  const toggleAssetType = (type: AssetTypeEnum) => {
    const newTypes = value.assetTypes.includes(type)
      ? value.assetTypes.filter(t => t !== type)
      : [...value.assetTypes, type];
    onChange({ ...value, assetTypes: newTypes });
  };

  // 切换标签
  const toggleTag = (tag: string) => {
    const newTags = value.tags.includes(tag)
      ? value.tags.filter(t => t !== tag)
      : [...value.tags, tag];
    onChange({ ...value, tags: newTags });
  };

  // 应用搜索
  const applySearch = () => {
    onChange({ ...value, search: searchText.trim() || undefined });
  };

  // 重置筛选
  const handleReset = () => {
    setSearchText("");
    onReset();
  };

  return (
    <div className="flex items-center gap-2">
      {/* 搜索框 */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索素材名称..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              applySearch();
            }
          }}
          className="pl-9 pr-8 h-9"
        />
        {searchText && (
          <button
            onClick={() => {
              setSearchText("");
              onChange({ ...value, search: undefined });
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-sm transition-colors"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* 筛选按钮 */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            筛选
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-5 min-w-[20px]">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          {/* Header - 固定不滚动 */}
          <div className="p-4 pb-3 border-b">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">筛选选项</h4>
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="h-7 text-xs"
                >
                  重置
                </Button>
              )}
            </div>
          </div>

          {/* 可滚动内容区域 */}
          <ScrollArea className="h-[400px]">
            <div className="p-4 space-y-4">
              {/* 素材类型 */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  素材类型
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {assetTypeOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = value.assetTypes.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        onClick={() => toggleAssetType(option.value)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-all",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 标签筛选 */}
              {tagStats.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      标签分类
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {tagStats.map(({ tag, count }) => {
                        const isSelected = value.tags.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all",
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background hover:bg-muted border-border"
                            )}
                          >
                            <Tag className="h-3.5 w-3.5" />
                            <span>{tag}</span>
                            <span className={cn(
                              "text-xs",
                              isSelected ? "opacity-90" : "text-muted-foreground"
                            )}>
                              ({count})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}

