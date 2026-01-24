"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  X,
  Search,
} from "lucide-react";
import type { AssetSelectionStatus } from "@/types/asset";
import { useTranslations } from "next-intl";

export interface AssetFilterOptions {
  search?: string;
  selectionStatus?: AssetSelectionStatus[];
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
