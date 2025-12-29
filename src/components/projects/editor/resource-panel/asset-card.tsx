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
import { Trash2, Maximize2 } from "lucide-react";
import { useState } from "react";
import Image from "next/image";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { Checkbox } from "@/components/ui/checkbox";
import { AssetThumbnailSkeleton } from "./asset-skeleton";

interface AssetCardProps {
  asset: AssetWithTags;
  viewMode: "grid" | "list";
  isSelected?: boolean;
  isBatchSelected?: boolean;
  onDelete: (asset: AssetWithTags) => void;
  onClick: (asset: AssetWithTags) => void;
  onSelectChange?: (assetId: string, selected: boolean) => void;
}

export function AssetCard({
  asset,
  viewMode,
  isSelected = false,
  isBatchSelected = false,
  onDelete,
  onClick,
  onSelectChange,
}: AssetCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // 检查素材是否正在生成中（没有图片）
  const isGenerating = !asset.imageUrl;

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

  // 共用的 Lightbox 组件（仅当有图片时才渲染）
  const lightbox = asset.imageUrl ? (
    <ImageLightbox
      open={lightboxOpen}
      onOpenChange={setLightboxOpen}
      src={asset.imageUrl}
      alt={asset.name}
      downloadFilename={`${asset.name}.png`}
    />
  ) : null;

  if (viewMode === "grid") {
    return (
      <>
        {lightbox}
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
          isSelected && "border-primary ring-2 ring-primary/20 bg-primary/5",
          isBatchSelected && "border-primary/60 ring-1 ring-primary/30 bg-primary/5"
        )}
      >
        {/* 缩略图区域 */}
        <div
          className="relative aspect-video bg-muted/30 overflow-hidden cursor-pointer"
          onClick={() => onClick(asset)}
        >
          {isGenerating ? (
            // 生成中状态 - 骨架屏
            <AssetThumbnailSkeleton />
          ) : (
            <Image
              src={asset.thumbnailUrl || asset.imageUrl!}
              alt={asset.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          )}
          {/* 悬停遮罩（仅在有图片时显示操作按钮） */}
          {isHovered && !isGenerating && (
            <div className="absolute inset-0 animate-in fade-in duration-200">
              {/* 左上角复选框 */}
              {onSelectChange && (
                <div
                  className="absolute top-2 left-2 z-10 cursor-pointer transition-transform hover:scale-110"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectChange(asset.id, !isBatchSelected);
                  }}
                >
                  <Checkbox
                    checked={isBatchSelected}
                    onCheckedChange={(checked) => {
                      onSelectChange(asset.id, checked === true);
                    }}
                    className="bg-background/90 backdrop-blur-sm border-2 shadow-lg hover:bg-background transition-colors cursor-pointer"
                  />
                </div>
              )}
              {/* 左上角放大按钮 */}
              <Button
                size="sm"
                variant="secondary"
                className={cn(
                  "absolute h-7 w-7 p-0 bg-black/50 backdrop-blur-sm border-0 text-white/80 hover:text-white hover:bg-black/70 shadow-lg cursor-pointer",
                  onSelectChange ? "top-2 right-2" : "top-2 left-2"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxOpen(true);
                }}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              {/* 右上角删除按钮（仅在非批量选择模式下显示） */}
              {!onSelectChange && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2 h-7 w-7 p-0 shadow-lg cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(asset);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
          {/* 非 hover 时也显示复选框（如果已选中且有图片） */}
          {!isHovered && isBatchSelected && onSelectChange && !isGenerating && (
            <div
              className="absolute top-2 left-2 z-10 animate-in fade-in duration-200 cursor-pointer transition-transform hover:scale-110"
              onClick={(e) => {
                e.stopPropagation();
                onSelectChange(asset.id, false);
              }}
            >
              <Checkbox
                checked={true}
                className="bg-background/90 backdrop-blur-sm border-2 shadow-lg hover:bg-background transition-colors cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* 信息区域 */}
        <div 
          className="p-3 space-y-1.5 cursor-pointer"
          onClick={() => onClick(asset)}
        >
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
      </>
    );
  }

  // 列表视图
  return (
    <>
      {lightbox}
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
        isSelected && "border-primary ring-2 ring-primary/20 bg-primary/5",
        isBatchSelected && "border-primary/60 ring-1 ring-primary/30 bg-primary/5"
      )}
      onClick={() => onClick(asset)}
    >
      {/* 缩略图 */}
      <div 
        className="relative w-12 h-12 rounded-md overflow-hidden bg-muted/30 shrink-0 group/thumb"
        onClick={(e) => {
          e.stopPropagation();
          if (!isGenerating) setLightboxOpen(true);
        }}
      >
        {isGenerating ? (
          // 生成中状态 - 骨架屏
          <AssetThumbnailSkeleton />
        ) : (
          <>
            <Image
              src={asset.thumbnailUrl || asset.imageUrl!}
              alt={asset.name}
              fill
              className="object-cover"
              sizes="48px"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
              <Maximize2 className="h-4 w-4 text-white" />
            </div>
          </>
        )}
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

      {/* 复选框（列表视图） */}
      {onSelectChange && (
        <div
          className={cn(
            "shrink-0 cursor-pointer transition-all hover:scale-110",
            isHovered || isBatchSelected ? "opacity-100" : "opacity-0"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelectChange(asset.id, !isBatchSelected);
          }}
        >
          <Checkbox
            checked={isBatchSelected}
            onCheckedChange={(checked) => {
              onSelectChange(asset.id, checked === true);
            }}
            className="bg-background border-2 hover:bg-accent transition-colors cursor-pointer"
          />
        </div>
      )}
      {/* 操作按钮 */}
      {isHovered && !onSelectChange && (
        <div className="flex items-center gap-1 shrink-0 animate-in fade-in slide-in-from-right-2 duration-200">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive cursor-pointer"
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
    </>
  );
}

