"use client";

import { useEffect, useRef, forwardRef } from "react";
import { cn } from "@/lib/utils";
import type { AssetWithFullData } from "@/types/asset";
import { getAssetIcon, getAssetTypeName } from "@/lib/utils/asset-icons";

interface AssetMentionDropdownProps {
  assets: AssetWithFullData[];
  selectedIndex: number;
  position: { top: number; left: number } | null;
  onSelect: (asset: AssetWithFullData) => void;
}

export const AssetMentionDropdown = forwardRef<HTMLDivElement, AssetMentionDropdownProps>(
  function AssetMentionDropdown({ assets, selectedIndex, position, onSelect }, ref) {
    const selectedItemRef = useRef<HTMLButtonElement>(null);

  // Scroll selected item into view when selection changes
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  if (!position || assets.length === 0) return null;

  return (
    <div
      ref={ref}
      className="absolute z-50 w-80 rounded-lg border bg-popover shadow-lg"
      style={{
        bottom: `${-position.top + 8}px`,
        left: `${position.left}px`,
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent losing focus
    >
      <div className="max-h-64 overflow-y-auto p-1">
        {assets.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            未找到匹配的素材
          </div>
        ) : (
          assets.map((asset, index) => (
            <button
              key={asset.id}
              ref={index === selectedIndex ? selectedItemRef : null}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
              onClick={() => onSelect(asset)}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border bg-muted">
                {asset.displayUrl ? (
                  <img
                    src={asset.displayUrl}
                    alt={asset.name}
                    className="h-full w-full rounded object-cover"
                  />
                ) : (
                  <div className="text-muted-foreground">
                    {getAssetIcon(asset, "h-4 w-4")}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-hidden">
                <div className="truncate font-medium">{asset.name}</div>
                <div className="text-xs text-muted-foreground">
                  {getAssetTypeName(asset)}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        <kbd className="rounded bg-muted px-1.5 py-0.5">↑↓</kbd> 导航{" "}
        <kbd className="rounded bg-muted px-1.5 py-0.5">Enter</kbd> 选择{" "}
        <kbd className="rounded bg-muted px-1.5 py-0.5">Esc</kbd> 关闭
      </div>
    </div>
  );
});
