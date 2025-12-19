"use client";

import { AssetWithTags } from "@/types/asset";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Edit, Trash2, Copy, Info } from "lucide-react";
import { useState } from "react";
import Image from "next/image";

interface AssetCardProps {
  asset: AssetWithTags;
  viewMode: "grid" | "list";
  isSelected?: boolean;
  onEdit: (asset: AssetWithTags) => void;
  onDelete: (asset: AssetWithTags) => void;
  onDerive: (asset: AssetWithTags) => void;
  onClick: (asset: AssetWithTags) => void;
}

export function AssetCard({
  asset,
  viewMode,
  isSelected = false,
  onEdit,
  onDelete,
  onDerive,
  onClick,
}: AssetCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    // 传递素材数据
    e.dataTransfer.setData("application/json", JSON.stringify({
      assetId: asset.id,
    }));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  if (viewMode === "grid") {
    return (
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "group relative rounded-lg border overflow-hidden transition-all cursor-move",
          "hover:border-primary/40 hover:bg-accent/50",
          isDragging && "opacity-50",
          isSelected && "border-primary ring-2 ring-primary/20 bg-primary/5"
        )}
      >
        {/* 缩略图区域 */}
        <div
          className="relative aspect-video bg-muted/30 overflow-hidden"
          onClick={() => onClick(asset)}
        >
          <Image
            src={asset.thumbnailUrl || asset.imageUrl}
            alt={asset.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          {/* 悬停遮罩 */}
          {isHovered && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center gap-1 animate-in fade-in duration-200">
              <Button
                size="sm"
                variant="secondary"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(asset);
                }}
              >
                <Info className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(asset);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onDerive(asset);
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(asset);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* 信息区域 */}
        <div className="p-3 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium truncate flex-1" title={asset.name}>
              {asset.name}
            </h4>
          </div>
          {/* 标签区域 - 单行显示，支持 hover 查看全部 */}
          {asset.tags.length > 0 ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                      {asset.tags.slice(0, 2).map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="secondary"
                          className="text-xs px-2 py-0 shrink-0"
                        >
                          {tag.tagValue}
                        </Badge>
                      ))}
                    </div>
                    {asset.tags.length > 2 && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        +{asset.tags.length - 2}
                      </span>
                    )}
                    {asset.usageCount > 0 && (
                      <Badge variant="outline" className="text-xs ml-auto shrink-0">
                        {asset.usageCount}次
                      </Badge>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="flex flex-wrap gap-1.5">
                    {asset.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className="text-xs"
                      >
                        {tag.tagValue}
                      </Badge>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            asset.usageCount > 0 && (
              <Badge variant="outline" className="text-xs w-fit">
                使用 {asset.usageCount}次
              </Badge>
            )
          )}
        </div>
      </div>
    );
  }

  // 列表视图
  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-move",
        "hover:border-primary/40 hover:bg-accent/50",
        isDragging && "opacity-50",
        isSelected && "border-primary ring-2 ring-primary/20 bg-primary/5"
      )}
      onClick={() => onClick(asset)}
    >
      {/* 缩略图 */}
      <div className="relative w-12 h-12 rounded-md overflow-hidden bg-muted/30 shrink-0">
        <Image
          src={asset.thumbnailUrl || asset.imageUrl}
          alt={asset.name}
          fill
          className="object-cover"
          sizes="48px"
        />
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium truncate">{asset.name}</h4>
        {/* 标签区域 - 单行显示，支持 hover 查看全部 */}
        {asset.tags.length > 0 ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                    {asset.tags.slice(0, 1).map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className="text-xs px-1.5 py-0 shrink-0"
                      >
                        {tag.tagValue}
                      </Badge>
                    ))}
                  </div>
                  {asset.tags.length > 1 && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      +{asset.tags.length - 1}
                    </span>
                  )}
                  {asset.usageCount > 0 && (
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">
                      {asset.usageCount}次
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="flex flex-wrap gap-1.5">
                  {asset.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="secondary"
                      className="text-xs"
                    >
                      {tag.tagValue}
                    </Badge>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          asset.usageCount > 0 && (
            <span className="text-xs text-muted-foreground mt-0.5">
              {asset.usageCount}次
            </span>
          )
        )}
      </div>

      {/* 操作按钮 */}
      {isHovered && (
        <div className="flex items-center gap-1 shrink-0 animate-in fade-in slide-in-from-right-2 duration-200">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(asset);
            }}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onDerive(asset);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(asset);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

