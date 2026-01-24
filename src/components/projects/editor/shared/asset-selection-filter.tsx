"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutGrid,
  Star,
  X,
  Circle,
} from "lucide-react";
import type { AssetSelectionStatus } from "@/types/asset";
import { useTranslations } from "next-intl";

type SelectionStatusOption = {
  value: AssetSelectionStatus | "all";
  labelKey: "all" | "selected" | "rejected" | "unrated";
  icon: typeof LayoutGrid;
};

const selectionStatusOptions: SelectionStatusOption[] = [
  { value: "all", labelKey: "all", icon: LayoutGrid },
  { value: "selected", labelKey: "selected", icon: Star },
  { value: "rejected", labelKey: "rejected", icon: X },
  { value: "unrated", labelKey: "unrated", icon: Circle },
];

interface AssetSelectionTabsProps {
  value: AssetSelectionStatus[];
  onChange: (statuses: AssetSelectionStatus[]) => void;
}

export function AssetSelectionTabs({ value, onChange }: AssetSelectionTabsProps) {
  const t = useTranslations("editor.assetSelectionFilter");
  const currentStatus: AssetSelectionStatus | "all" =
    value.length === 1 ? value[0] : "all";

  const handleStatusChange = (status: string) => {
    if (status === "all") {
      onChange([]);
    } else {
      onChange([status as AssetSelectionStatus]);
    }
  };

  return (
    <Tabs value={currentStatus} onValueChange={handleStatusChange}>
      <TabsList>
        {selectionStatusOptions.map((option) => {
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
