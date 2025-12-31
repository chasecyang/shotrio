"use client";

import { AssetWithRuntimeStatus } from "@/types/asset";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Trash2, Maximize2, Video, Play } from "lucide-react";
import { useState } from "react";
import Image from "next/image";
import { Checkbox } from "@/components/ui/checkbox";
import { AssetThumbnailSkeleton } from "./asset-skeleton";
import { AssetProgressOverlay } from "./asset-progress-overlay";
import type { Job } from "@/types/job";

interface AssetCardProps {
  asset: AssetWithRuntimeStatus;
  isSelected?: boolean;
  isBatchSelected?: boolean;
  onDelete: (asset: AssetWithRuntimeStatus) => void;
  onClick: (asset: AssetWithRuntimeStatus) => void;
  onSelectChange?: (assetId: string, selected: boolean) => void;
  job?: Job;
}

export function AssetCard({
  asset,
  isSelected = false,
  isBatchSelected = false,
  onDelete,
  onClick,
  onSelectChange,
  job,
}: AssetCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 检查资产类型
  const isVideo = asset.assetType === "video";
  
  // 检查资产是否正在生成中（使用运行时状态）
  const isGenerating = asset.runtimeStatus === "processing" || asset.runtimeStatus === "pending";
  
  // 检查资产是否失败
  const isFailed = asset.runtimeStatus === "failed";
  
  // 获取显示 URL（视频优先使用 thumbnailUrl，图片使用 imageUrl 或 thumbnailUrl）
  const displayUrl = isVideo 
    ? asset.thumbnailUrl // 视频只使用 thumbnailUrl，不使用 videoUrl（videoUrl 不是图片）
    : asset.thumbnailUrl || asset.imageUrl;

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
            // 生成中状态 - 显示骨架屏和进度覆盖层
            <>
              <AssetThumbnailSkeleton />
              <AssetProgressOverlay job={job} asset={asset} />
            </>
          ) : isFailed ? (
            // 失败状态 - 显示失败覆盖层
            <>
              <div className="absolute inset-0 bg-muted/50" />
              <AssetProgressOverlay asset={asset} job={job} />
            </>
          ) : displayUrl ? (
            <>
              <Image
                src={displayUrl}
                alt={asset.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              {/* 视频播放图标 */}
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm">
                    <Play className="h-6 w-6 text-white fill-white" />
                  </div>
                </div>
              )}
            </>
          ) : (
            // 无缩略图 - 显示默认图标
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Video className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          {/* 悬停遮罩（仅在生成中时不显示操作按钮） */}
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
              {/* 左上角放大按钮（仅非批量选择模式且非失败状态） */}
              {!onSelectChange && !isVideo && !isFailed && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 left-2 h-7 w-7 p-0 bg-black/50 backdrop-blur-sm border-0 text-white/80 hover:text-white hover:bg-black/70 shadow-lg cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick(asset);
                  }}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              )}
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
          {/* 非 hover 时也显示复选框（如果已选中） */}
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
          {/* 标签和信息区域 - 单行显示，支持 hover 查看全部 */}
          <div className="flex items-center gap-1.5">
            {/* 视频类型标签 */}
            {isVideo && (
              <Badge variant="default" className="text-xs px-2 py-0 shrink-0 gap-1">
                <Video className="h-3 w-3" />
                视频
              </Badge>
            )}
            {/* 视频时长 */}
            {isVideo && asset.duration && (
              <Badge variant="secondary" className="text-xs px-2 py-0 shrink-0">
                {Math.round(asset.duration / 1000)}秒
              </Badge>
            )}
            {/* 状态标签 */}
            {isGenerating && (
              <Badge variant="secondary" className="text-xs px-2 py-0 shrink-0">
                生成中
              </Badge>
            )}
            {isFailed && (
              <Badge variant="destructive" className="text-xs px-2 py-0 shrink-0">
                失败
              </Badge>
            )}
            {/* 标签 */}
            {asset.tags.length > 0 ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                        {asset.tags.slice(0, 1).map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            className="text-xs px-2 py-0 shrink-0"
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
            ) : null}
            {asset.usageCount > 0 && (
              <Badge variant="outline" className="text-xs ml-auto shrink-0">
                {asset.usageCount}次
              </Badge>
            )}
          </div>
        </div>

        {/* Prompt 显示区域 */}
        {asset.prompt && (
          <div className="px-3 pb-2">
            <p className="text-xs text-muted-foreground line-clamp-2">
              {asset.prompt}
            </p>
          </div>
        )}
      </div>
    );
}

