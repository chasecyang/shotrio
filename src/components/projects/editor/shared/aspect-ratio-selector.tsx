"use client";

import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import type { AspectRatio } from "@/lib/services/image.service";

interface AspectRatioSelectorProps {
  value: AspectRatio | "auto";
  onChange: (value: AspectRatio | "auto") => void;
  videoOnly?: boolean;
}

const ASPECT_RATIOS: Array<{ value: AspectRatio | "auto"; label: string }> = [
  { value: "auto", label: "自动" },
  { value: "21:9", label: "21:9" },
  { value: "16:9", label: "16:9" },
  { value: "3:2", label: "3:2" },
  { value: "4:3", label: "4:3" },
  { value: "1:1", label: "1:1" },
  { value: "3:4", label: "3:4" },
  { value: "2:3", label: "2:3" },
  { value: "9:16", label: "9:16" },
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
  const ratios = videoOnly
    ? ASPECT_RATIOS.filter(r => r.value === "16:9" || r.value === "9:16")
    : ASPECT_RATIOS;

  return (
    <div className="flex flex-wrap gap-1.5">
      {ratios.map((ratio) => {
        const isSelected = value === ratio.value;
        const { width, height } = getRatioDimensions(ratio.value);

        return (
          <button
            key={ratio.value}
            type="button"
            onClick={() => onChange(ratio.value)}
            className={cn(
              "group relative flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all",
              "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              "hover:bg-muted/60",
              isSelected
                ? "bg-primary/10 ring-1 ring-primary/50"
                : "bg-muted/30 hover:ring-1 hover:ring-border"
            )}
            title={ratio.label}
          >
            {ratio.value === "auto" ? (
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
              {ratio.value === "auto" ? "自动" : ratio.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
