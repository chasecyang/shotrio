"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  X,
  Search,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  LayoutGrid,
} from "lucide-react";
import type { AssetTypeEnum } from "@/types/asset";
import type { AssetSelectionStatus } from "@/types/asset";
import { useTranslations } from "next-intl";

export interface AssetFilterOptions {
  search?: string;
  assetTypes: AssetTypeEnum[];
  selectionStatus?: AssetSelectionStatus[];
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

// 类型 Tab 组件
interface AssetTypeTabsProps {
  value: AssetTypeEnum[];
  onChange: (types: AssetTypeEnum[]) => void;
}

export function AssetTypeTabs({ value, onChange }: AssetTypeTabsProps) {
  const t = useTranslations("editor.assetFilter");
  const currentType: AssetTypeEnum | "all" =
    value.length === 1 ? value[0] : "all";

  const handleTypeChange = (type: string) => {
    if (type === "all") {
      onChange([]);
    } else {
      onChange([type as AssetTypeEnum]);
    }
  };

  return (
    <Tabs value={currentType} onValueChange={handleTypeChange}>
      <TabsList>
        {assetTypeOptions.map((option) => {
          const Icon = option.icon;
          return (
            <TabsTrigger key={option.value} value={option.value}>
              <Icon className="h-4 w-4" />
              {t(option.labelKey)}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

// 搜索组件
interface AssetSearchProps {
  search?: string;
  onSearchChange: (search: string | undefined) => void;
}

export function AssetSearch({
  search,
  onSearchChange,
}: AssetSearchProps) {
  const t = useTranslations("editor.assetFilter");
  const [searchText, setSearchText] = useState(search || "");

  const applySearch = () => {
    onSearchChange(searchText.trim() || undefined);
  };

  return (
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
  );
}
