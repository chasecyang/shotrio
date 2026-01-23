"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { AssetReference } from "@/lib/utils/asset-reference";
import { getAssetIcon, guessAssetTypeFromName } from "@/lib/utils/asset-icons";
import { ASSET_REFERENCE_CHIP_STYLES } from "@/lib/utils/asset-styles";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AssetReferenceChipProps {
  reference: AssetReference;
  onRemove?: () => void;
  variant?: "default" | "compact";
}

export function AssetReferenceChip({
  reference,
  onRemove,
  variant = "default",
}: AssetReferenceChipProps) {
  const [isHovered, setIsHovered] = useState(false);

  // 根据素材名称猜测类型并获取图标
  const assetType = guessAssetTypeFromName(reference.name);
  const icon = getAssetIcon(assetType, variant === "compact" ? "h-3 w-3" : "h-3 w-3");

  if (variant === "compact") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs",
                ASSET_REFERENCE_CHIP_STYLES,
                "hover:bg-primary/20 transition-colors cursor-default"
              )}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {icon}
              <span className="max-w-[100px] truncate">{reference.name}</span>
              {onRemove && isHovered && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  className="ml-0.5 hover:text-destructive"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{reference.name}</p>
            <p className="text-xs text-muted-foreground">ID: {reference.id}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm",
        ASSET_REFERENCE_CHIP_STYLES,
        "hover:bg-primary/20 transition-colors cursor-default"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {icon}
      <span className="font-medium">{reference.name}</span>
      {onRemove && isHovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:text-destructive transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
