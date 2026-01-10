"use client";

import { cn } from "@/lib/utils";
import type { ImageResolution } from "@/types/asset";

interface ResolutionSelectorProps {
  value: ImageResolution;
  onChange: (value: ImageResolution) => void;
}

const RESOLUTIONS: Array<{ value: ImageResolution; label: string }> = [
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
];

export function ResolutionSelector({ value, onChange }: ResolutionSelectorProps) {
  return (
    <div className="inline-flex rounded-lg bg-muted/40 p-0.5">
      {RESOLUTIONS.map((res) => {
        const isSelected = value === res.value;
        return (
          <button
            key={res.value}
            type="button"
            onClick={() => onChange(res.value)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
              isSelected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {res.label}
          </button>
        );
      })}
    </div>
  );
}
