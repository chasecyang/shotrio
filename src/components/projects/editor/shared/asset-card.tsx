"use client";

import { AssetWithFullData } from "@/types/asset";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Trash2, Video, Play, FileText, RefreshCw, Pencil, ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import type { ImageData, VideoData } from "@/types/asset";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Checkbox } from "@/components/ui/checkbox";
import { AssetProgressOverlay } from "./asset-progress-overlay";
import type { Job } from "@/types/job";

interface AssetCardProps {
  asset: AssetWithFullData;
  isBatchSelected?: boolean;
  onDelete: (asset: AssetWithFullData) => void;
  onClick: (asset: AssetWithFullData) => void;
  onSelectChange?: (assetId: string, selected: boolean) => void;
  onRegenerate?: (asset: AssetWithFullData) => void;
  onEdit?: (asset: AssetWithFullData) => void;
  onSetActiveVersion?: (assetId: string, versionId: string) => void;
  job?: Job;
}

// 版本信息类型
interface VersionInfo {
  id: string;
  url: string | null;
  thumbnailUrl: string | null;
  isActive: boolean;
  isGenerating: boolean;
  prompt: string | null;
  createdAt: Date;
}

export function AssetCard({
  asset,
  isBatchSelected = false,
  onDelete,
  onClick,
  onSelectChange,
  onRegenerate,
  onEdit,
  onSetActiveVersion,
  job,
}: AssetCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [displayedVersionIndex, setDisplayedVersionIndex] = useState(0);

  // 检查资产类型
  const isVideo = asset.assetType === "video";
  const isText = asset.assetType === "text";
  const isImage = asset.assetType === "image";

  // 检查是否可以重新生成/编辑（仅 AI 生成的素材且有 prompt）
  const isGenerated = asset.sourceType === "generated";

  // 计算版本列表（从 imageDataList 或 videoDataList）
  const versions = useMemo((): VersionInfo[] => {
    if (isImage && asset.imageDataList && asset.imageDataList.length > 0) {
      return asset.imageDataList.map((img: ImageData) => ({
        id: img.id,
        url: img.imageUrl,
        thumbnailUrl: img.thumbnailUrl,
        isActive: img.isActive,
        isGenerating: !img.imageUrl, // 没有 URL 说明正在生成
        prompt: img.prompt,
        createdAt: img.createdAt,
      }));
    }
    if (isVideo && asset.videoDataList && asset.videoDataList.length > 0) {
      return asset.videoDataList.map((vid: VideoData) => ({
        id: vid.id,
        url: vid.videoUrl,
        thumbnailUrl: vid.thumbnailUrl,
        isActive: vid.isActive,
        isGenerating: !vid.videoUrl && !vid.thumbnailUrl, // 没有 URL 说明正在生成
        prompt: vid.prompt,
        createdAt: vid.createdAt,
      }));
    }
    // 单版本或无版本信息时返回空数组
    return [];
  }, [asset.imageDataList, asset.videoDataList, isImage, isVideo]);

  // 是否有多个版本
  const hasMultipleVersions = versions.length > 1;

  // 当前显示的版本
  const displayedVersion = versions[displayedVersionIndex] || null;

  // 当前显示的版本是否正在生成
  const isDisplayedVersionGenerating = displayedVersion?.isGenerating ?? false;

  // 当前显示的版本是否是活跃版本
  const isDisplayedVersionActive = displayedVersion?.isActive ?? true;

  // 当 versions 变化时，如果有新的生成完成的版本，自动切换到该版本
  useEffect(() => {
    // 如果新版本生成完成（最后一个版本从生成中变为完成），自动切换
    if (versions.length > 0) {
      const lastVersion = versions[versions.length - 1];
      if (lastVersion && !lastVersion.isGenerating && lastVersion.isActive) {
        setDisplayedVersionIndex(versions.length - 1);
      }
    }
  }, [versions]);

  // 计算显示的 URL
  const displayUrl = useMemo(() => {
    if (displayedVersion) {
      return displayedVersion.thumbnailUrl || displayedVersion.url;
    }
    return asset.displayUrl;
  }, [displayedVersion, asset.displayUrl]);

  // 检查整个资产是否正在生成中（用于兜底情况：没有版本数据时）
  const isAssetGenerating = asset.runtimeStatus === "processing" || asset.runtimeStatus === "pending";

  // 最终的 isGenerating 判断
  const isGenerating = versions.length > 0 ? isDisplayedVersionGenerating : isAssetGenerating;

  // 检查资产是否失败
  const isFailed = asset.runtimeStatus === "failed";

  // 获取 job - 使用传入的 job（运行时状态已在 asset.runtimeStatus 中计算）
  const currentJob = job;

  // 当前显示版本的 prompt
  const displayedPrompt = displayedVersion?.prompt ?? asset.prompt;

  // 是否可以重新生成（基于当前显示的版本）
  const canRegenerate = isGenerated && !isText && !!displayedPrompt;

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

  // 版本切换处理
  const handlePrevVersion = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (displayedVersionIndex > 0) {
      setDisplayedVersionIndex(displayedVersionIndex - 1);
    }
  };

  const handleNextVersion = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (displayedVersionIndex < versions.length - 1) {
      setDisplayedVersionIndex(displayedVersionIndex + 1);
    }
  };

  const handleVersionDotClick = (index: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setDisplayedVersionIndex(index);
  };

  // 设置活跃版本
  const handleSetActiveVersion = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (displayedVersion && onSetActiveVersion && !isDisplayedVersionActive) {
      onSetActiveVersion(asset.id, displayedVersion.id);
    }
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

        {/* 版本导航 - 仅当有多个版本时显示 */}
        {hasMultipleVersions && (
          <>
            {/* 左右箭头 - hover 时显示 */}
            {isHovered && !isGenerating && (
              <>
                {displayedVersionIndex > 0 && (
                  <button
                    onClick={handlePrevVersion}
                    className="absolute left-1 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-black/50 hover:bg-black/70 text-white/90 hover:text-white backdrop-blur-sm transition-all hover:scale-110"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                {displayedVersionIndex < versions.length - 1 && (
                  <button
                    onClick={handleNextVersion}
                    className="absolute right-1 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-black/50 hover:bg-black/70 text-white/90 hover:text-white backdrop-blur-sm transition-all hover:scale-110"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </>
            )}

            {/* 版本指示点 - 始终显示 */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm">
              {versions.map((version, index) => (
                <button
                  key={version.id}
                  onClick={handleVersionDotClick(index)}
                  className={cn(
                    "transition-all flex items-center justify-center",
                    version.isGenerating
                      ? "w-3 h-3 text-white/90"
                      : index === displayedVersionIndex
                        ? "w-2 h-2 rounded-full bg-white"
                        : "w-1.5 h-1.5 rounded-full bg-white/50 hover:bg-white/80"
                  )}
                >
                  {version.isGenerating && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {/* 底部操作栏 */}
        {isHovered && !isGenerating && !isFailed && (
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 via-black/40 to-transparent pointer-events-none animate-in fade-in slide-in-from-bottom-1 duration-200">
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center gap-1 pointer-events-auto">
                {/* 编辑按钮 */}
                {canRegenerate && onEdit && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 bg-white/10 hover:bg-white/25 text-white/90 hover:text-white backdrop-blur-sm transition-all hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(asset);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      编辑生成参数
                    </TooltipContent>
                  </Tooltip>
                )}
                {/* 重新生成按钮 */}
                {canRegenerate && onRegenerate && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 bg-white/10 hover:bg-white/25 text-white/90 hover:text-white backdrop-blur-sm transition-all hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRegenerate(asset);
                        }}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      重新生成
                    </TooltipContent>
                  </Tooltip>
                )}
                {/* 使用此版本按钮 - 仅当查看非活跃版本时显示 */}
                {hasMultipleVersions && !isDisplayedVersionActive && onSetActiveVersion && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 bg-primary/80 hover:bg-primary text-white hover:text-white backdrop-blur-sm transition-all hover:scale-105"
                        onClick={handleSetActiveVersion}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      使用此版本
                    </TooltipContent>
                  </Tooltip>
                )}
                {/* 删除按钮 - 推到右边 */}
                <div className="ml-auto">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 bg-white/10 hover:bg-destructive/80 text-white/90 hover:text-white backdrop-blur-sm transition-all hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(asset);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      删除
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </TooltipProvider>
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
      {displayedPrompt && (
        <div className="px-3 pb-2">
          <p className="text-xs text-muted-foreground line-clamp-2">
            {displayedPrompt}
          </p>
        </div>
      )}
    </div>
  );
}

