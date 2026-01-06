"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  X,
  Search,
  Image as ImageIcon,
  Video,
  FileText,
  ArrowUpDown,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetTypeEnum } from "@/types/asset";

export type SortOption = "createdAt" | "name" | "usageCount";

export interface AssetFilterOptions {
  search?: string;
  assetTypes: AssetTypeEnum[];
  sort: SortOption;
}

interface AssetFilterProps {
  value: AssetFilterOptions;
  onChange: (value: AssetFilterOptions) => void;
}

const assetTypeOptions: {
  value: AssetTypeEnum | "all";
  label: string;
  icon: typeof ImageIcon;
}[] = [
  { value: "all", label: "全部", icon: LayoutGrid },
  { value: "image", label: "图片", icon: ImageIcon },
  { value: "video", label: "视频", icon: Video },
  { value: "text", label: "文本", icon: FileText },
];

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "createdAt", label: "最新创建" },
  { value: "name", label: "名称" },
  { value: "usageCount", label: "使用次数" },
];

export function AssetFilter({ value, onChange }: AssetFilterProps) {
  const [searchText, setSearchText] = useState(value.search || "");

  const applySearch = () => {
    onChange({ ...value, search: searchText.trim() || undefined });
  };

  const handleTypeChange = (type: AssetTypeEnum | "all") => {
    if (type === "all") {
      onChange({ ...value, assetTypes: [] });
    } else {
      onChange({ ...value, assetTypes: [type] });
    }
  };

  const currentType: AssetTypeEnum | "all" =
    value.assetTypes.length === 1 ? value.assetTypes[0] : "all";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* 类型 Tab */}
      <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
        {assetTypeOptions.map((option) => {
          const Icon = option.icon;
          const isActive = currentType === option.value;
          return (
            <button
              key={option.value}
              onClick={() => handleTypeChange(option.value)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* 排序下拉 */}
      <Select
        value={value.sort}
        onValueChange={(val) => onChange({ ...value, sort: val as SortOption })}
      >
        <SelectTrigger className="w-[130px] h-8">
          <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 搜索框 */}
      <div className="relative flex-1 min-w-[160px] max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="搜索素材..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              applySearch();
            }
          }}
          className="pl-9 pr-8 h-8 text-sm"
        />
        {searchText && (
          <button
            onClick={() => {
              setSearchText("");
              onChange({ ...value, search: undefined });
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-sm transition-colors"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
