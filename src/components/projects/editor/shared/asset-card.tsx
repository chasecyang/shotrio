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
import { Trash2, Maximize2, Video, Play, FileText } from "lucide-react";
import { useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Checkbox } from "@/components/ui/checkbox";
import { AssetProgressOverlay } from "./asset-progress-overlay";
import type { Job } from "@/types/job";

interface AssetCardProps {
  asset: AssetWithRuntimeStatus;
  isBatchSelected?: boolean;
  onDelete: (asset: AssetWithRuntimeStatus) => void;
  onClick: (asset: AssetWithRuntimeStatus) => void;
  onSelectChange?: (assetId: string, selected: boolean) => void;
  job?: Job;
}

export function AssetCard({
  asset,
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
  const isText = asset.assetType === "text";
  
  // 检查资产是否正在生成中（使用运行时状态）
  const isGenerating = asset.runtimeStatus === "processing" || asset.runtimeStatus === "pending";
  
  // 检查资产是否失败
  const isFailed = asset.runtimeStatus === "failed";
  
  // 获取 job - 优先使用传入的 job，否则使用 asset.latestJob
  const currentJob = job || asset.latestJob || undefined;
  
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
        isBatchSelected && "border-primary/60 ring-1 ring-primary/30 bg-primary/5"
      )}
    >
      {/* 缩略图区域 */}
      <div
        className="relative aspect-video bg-muted/30 overflow-hidden cursor-pointer"
        onClick={() => onClick(asset)}
      >
        {isText ? (
          // 文本资产 - 显示文本图标和预览
          <div className="absolute inset-0 flex flex-col p-3 bg-muted/20">
            <div className="flex items-center gap-1.5 mb-2 opacity-70">
              <FileText className="h-4 w-4 text-foreground/70" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Text
              </span>
            </div>
            <div className="flex-1 w-full overflow-hidden relative">
              <div className="text-[10px] leading-relaxed text-foreground/80 break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                    h1: ({ children }) => <h1 className="text-xs font-bold mb-1 mt-2 first:mt-0">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-xs font-bold mb-1 mt-2 first:mt-0">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-[11px] font-semibold mb-1 mt-1 first:mt-0">{children}</h3>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-1 pl-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-1 pl-1">{children}</ol>,
                    li: ({ children }) => <li className="mb-0.5">{children}</li>,
                    code: ({ children }) => <code className="bg-muted px-1 rounded font-mono text-[9px]">{children}</code>,
                    pre: ({ children }) => <pre className="bg-muted p-1 rounded mb-1 overflow-hidden">{children}</pre>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-muted pl-2 italic my-1">{children}</blockquote>,
                  }}
                >
                  {asset.textContent || ""}
                </ReactMarkdown>
              </div>
              {/* 底部渐变遮罩 */}
              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background/10 to-transparent pointer-events-none" />
            </div>
          </div>
        ) : isGenerating ? (
          // 生成中状态 - 显示渐变背景和进度覆盖层
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-background/50">
              {/* 动画网格背景 */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
              </div>
              {/* 脉动光晕 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-primary/20 blur-3xl animate-pulse" />
              </div>
            </div>
            <AssetProgressOverlay job={currentJob} asset={asset} />
          </>
        ) : isFailed ? (
          // 失败状态 - 显示失败覆盖层
          <>
            <div className="absolute inset-0 bg-muted/50" />
            <AssetProgressOverlay asset={asset} job={currentJob} />
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
        {/* 复选框 - 始终渲染同一个元素，避免 hover 时的抽动 */}
        {onSelectChange && !isGenerating && (isBatchSelected || isHovered) && (
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
        {/* 悬停遮罩（仅在有内容时显示操作按钮） */}
        {isHovered && !isGenerating && (
          <div className="absolute inset-0 animate-in fade-in duration-200 pointer-events-none">
            {/* 左上角放大按钮（仅非批量选择模式，且非视频和文本） */}
            {!onSelectChange && !isVideo && !isText && (
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-2 left-2 h-7 w-7 p-0 bg-black/50 backdrop-blur-sm border-0 text-white/80 hover:text-white hover:bg-black/70 shadow-lg cursor-pointer pointer-events-auto"
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
                className="absolute top-2 right-2 h-7 w-7 p-0 shadow-lg cursor-pointer pointer-events-auto"
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
      </div>

      {/* 信息区域 */}
      <div 
        className="p-3 space-y-2 cursor-pointer"
        onClick={() => onClick(asset)}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium truncate flex-1" title={asset.name}>
            {asset.name}
          </h4>
        </div>
        {/* 标签和信息区域 - 始终单行显示，根据容器宽度自适应 */}
        <div className="flex items-center gap-1.5 min-w-0">
          {/* 视频时长 - 仅在非生成和非失败状态显示 */}
          {isVideo && asset.duration && !isGenerating && !isFailed && (
            <Badge variant="secondary" className="text-xs px-2 py-0 shrink-0">
              {Math.round(asset.duration / 1000)}秒
            </Badge>
          )}
          {/* 标签 - 根据容器宽度自适应显示，始终单行 */}
          {asset.tags.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                    {asset.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="text-xs px-2 py-0 shrink-0"
                      >
                        {tag.tagValue}
                      </Badge>
                    ))}
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
          )}
          {asset.usageCount > 0 && !isGenerating && !isFailed && (
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

