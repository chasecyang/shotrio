"use client";

import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import type { AspectRatio } from "@/lib/services/image.service";
import { useTranslations } from "next-intl";

interface AspectRatioSelectorProps {
  value: AspectRatio | "auto";
  onChange: (value: AspectRatio | "auto") => void;
  videoOnly?: boolean;
}

const ASPECT_RATIO_VALUES: Array<AspectRatio | "auto"> = [
  "auto",
  "21:9",
  "16:9",
  "3:2",
  "4:3",
  "1:1",
  "3:4",
  "2:3",
  "9:16",
];

// 计算比例的宽高
function getRatioDimensions(ratio: AspectRatio | "auto"): { width: number; height: number } {
  if (ratio === "auto") return { width: 16, height: 16 };
  const [w, h] = ratio.split(":").map(Number);
  const maxDim = 20;
  const scale = maxDim / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export function AspectRatioSelector({ value, onChange, videoOnly = false }: AspectRatioSelectorProps) {
  const t = useTranslations("editor.aspectRatios");

  const ratios = videoOnly
    ? ASPECT_RATIO_VALUES.filter(r => r === "16:9" || r === "9:16")
    : ASPECT_RATIO_VALUES;

  const getLabel = (ratio: AspectRatio | "auto") => {
    if (ratio === "auto") return t("auto");
    return ratio;
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {ratios.map((ratio) => {
        const isSelected = value === ratio;
        const { width, height } = getRatioDimensions(ratio);
        const label = getLabel(ratio);

        return (
          <button
            key={ratio}
            type="button"
            onClick={() => onChange(ratio)}
            className={cn(
              "group relative flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all",
              "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              "hover:bg-muted/60",
              isSelected
                ? "bg-primary/10 ring-1 ring-primary/50"
                : "bg-muted/30 hover:ring-1 hover:ring-border"
            )}
            title={label}
          >
            {ratio === "auto" ? (
              <div
                className={cn(
                  "flex items-center justify-center rounded-sm transition-colors w-5 h-5",
                  isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              >
                <Sparkles className="h-4 w-4" />
              </div>
            ) : (
              <div
                className={cn(
                  "rounded-sm border transition-colors",
                  isSelected
                    ? "bg-primary/20 border-primary/40"
                    : "bg-muted/50 border-border group-hover:border-foreground/30"
                )}
                style={{ width, height }}
              />
            )}
            <span
              className={cn(
                "text-[10px] leading-none transition-colors",
                isSelected ? "text-primary font-medium" : "text-muted-foreground group-hover:text-foreground"
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
