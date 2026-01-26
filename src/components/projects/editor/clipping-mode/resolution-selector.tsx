"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Monitor } from "lucide-react";

interface ResolutionSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

// 预设分辨率选项
const RESOLUTION_PRESETS = [
  { value: "1920x1080", labelKey: "landscape", description: "1920×1080" },
  { value: "1080x1920", labelKey: "portrait", description: "1080×1920" },
  { value: "1080x1080", labelKey: "square", description: "1080×1080" },
  { value: "3840x2160", labelKey: "4k", description: "3840×2160" },
];

/**
 * 分辨率选择器组件
 */
export function ResolutionSelector({
  value,
  onValueChange,
  disabled,
}: ResolutionSelectorProps) {
  const t = useTranslations("editor.resolutionSelector");
  // 找到当前选中的预设
  const currentPreset = RESOLUTION_PRESETS.find((p) => p.value === value);
  const displayLabel = currentPreset ? t(currentPreset.labelKey) : value;

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger size="sm" className="w-auto gap-1.5 text-xs">
        <Monitor className="h-3.5 w-3.5" />
        <SelectValue>{displayLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {RESOLUTION_PRESETS.map((preset) => (
          <SelectItem key={preset.value} value={preset.value}>
            <div className="flex items-center justify-between gap-4">
              <span>{t(preset.labelKey)}</span>
              <span className="text-xs text-muted-foreground">
                {preset.description}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
