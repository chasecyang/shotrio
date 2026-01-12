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
  Music,
  ArrowUpDown,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetTypeEnum } from "@/types/asset";
import { useTranslations } from "next-intl";

export type SortOption = "createdAt" | "name" | "usageCount";

export interface AssetFilterOptions {
  search?: string;
  assetTypes: AssetTypeEnum[];
  sort: SortOption;
}

type AssetTypeOption = {
  value: AssetTypeEnum | "all";
  labelKey: "all" | "image" | "video" | "text" | "audio";
  icon: typeof ImageIcon;
};

const assetTypeOptions: AssetTypeOption[] = [
  { value: "all", labelKey: "all", icon: LayoutGrid },
  { value: "image", labelKey: "image", icon: ImageIcon },
  { value: "video", labelKey: "video", icon: Video },
  { value: "text", labelKey: "text", icon: FileText },
  { value: "audio", labelKey: "audio", icon: Music },
];

type SortOptionItem = {
  value: SortOption;
  labelKey: "sortNewest" | "sortName" | "sortUsage";
};

const sortOptions: SortOptionItem[] = [
  { value: "createdAt", labelKey: "sortNewest" },
  { value: "name", labelKey: "sortName" },
  { value: "usageCount", labelKey: "sortUsage" },
];

// 类型 Tab 组件
interface AssetTypeTabsProps {
  value: AssetTypeEnum[];
  onChange: (types: AssetTypeEnum[]) => void;
}

export function AssetTypeTabs({ value, onChange }: AssetTypeTabsProps) {
  const t = useTranslations("editor.assetFilter");
  const currentType: AssetTypeEnum | "all" =
    value.length === 1 ? value[0] : "all";

  const handleTypeChange = (type: AssetTypeEnum | "all") => {
    if (type === "all") {
      onChange([]);
    } else {
      onChange([type]);
    }
  };

  return (
    <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
      {assetTypeOptions.map((option) => {
        const Icon = option.icon;
        const isActive = currentType === option.value;
        return (
          <button
            key={option.value}
            onClick={() => handleTypeChange(option.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 h-7 rounded-md text-sm font-medium transition-all",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{t(option.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}

// 搜索和排序组件
interface AssetSearchSortProps {
  search?: string;
  sort: SortOption;
  onSearchChange: (search: string | undefined) => void;
  onSortChange: (sort: SortOption) => void;
}

export function AssetSearchSort({
  search,
  sort,
  onSearchChange,
  onSortChange,
}: AssetSearchSortProps) {
  const t = useTranslations("editor.assetFilter");
  const [searchText, setSearchText] = useState(search || "");

  const applySearch = () => {
    onSearchChange(searchText.trim() || undefined);
  };

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      {/* 搜索框 */}
      <div className="relative flex-1 min-w-[120px] max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              applySearch();
            }
          }}
          className="pl-9 pr-8 h-7 text-sm"
        />
        {searchText && (
          <button
            onClick={() => {
              setSearchText("");
              onSearchChange(undefined);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-sm transition-colors"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* 排序下拉 */}
      <Select value={sort} onValueChange={(val) => onSortChange(val as SortOption)}>
        <SelectTrigger className="w-[130px] h-7 shrink-0">
          <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
