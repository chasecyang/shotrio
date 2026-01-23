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
import { Trash2, Video, Play, FileText, Music, RefreshCw, Pencil, AtSign } from "lucide-react";
import { useState } from "react";
import { VersionCountBadge } from "./asset-version-panel";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Checkbox } from "@/components/ui/checkbox";
import { AssetProgressOverlay } from "./asset-progress-overlay";
import type { Job } from "@/types/job";
import { useTranslations } from "next-intl";

interface AssetCardProps {
  asset: AssetWithFullData;
  isBatchSelected?: boolean;
  onDelete: (asset: AssetWithFullData) => void;
  onClick: (asset: AssetWithFullData) => void;
  onSelectChange?: (assetId: string, selected: boolean) => void;
  onRegenerate?: (asset: AssetWithFullData) => void;
  onEdit?: (asset: AssetWithFullData) => void;
  onReference?: (asset: AssetWithFullData) => void;
  job?: Job;
}

export function AssetCard({
  asset,
  isBatchSelected = false,
  onDelete,
  onClick,
  onSelectChange,
  onRegenerate,
  onEdit,
  onReference,
  job,
}: AssetCardProps) {
  const t = useTranslations("editor.assetCard");
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);

  // 检查资产类型
  const isVideo = asset.assetType === "video";
  const isText = asset.assetType === "text";
  const isAudio = asset.assetType === "audio";

  // 检查是否可以重新生成/编辑（仅 AI 生成的素材且有 prompt）
  const isGenerated = asset.sourceType === "generated";

  // 检查资产是否正在生成中
  const isGenerating = asset.runtimeStatus === "processing" || asset.runtimeStatus === "pending";

  // 检查资产是否失败
  const isFailed = asset.runtimeStatus === "failed";

  // 检查是否有其他版本正在生成（当前激活版本已完成但有其他版本正在生成）
  const hasOtherGenerating = asset.hasOtherVersionGenerating && !isGenerating && !isFailed;

  // 获取 job
  const currentJob = job;

  // 是否可以重新生成（仅 AI 生成的素材）
  const canRegenerate = isGenerated && !isText && !!asset.prompt;

  // 是否可以 AI 编辑（仅图片素材可以）
  const canEdit = !isVideo && !isText && !isAudio;

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
        "group relative rounded-lg border overflow-hidden transition-all cursor-move bg-card",
        "hover:border-primary/40 hover:bg-accent/50",
        isDragging && "opacity-50",
        isBatchSelected && "border-primary/60 ring-1 ring-primary/30 bg-primary/5 dark:shadow-[var(--safelight-glow)]"
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
        ) : isAudio ? (
          // 音频资产 - 需要区分生成中、失败和成功状态
          isGenerating ? (
            // 生成中状态
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
              <div className="absolute inset-0 bg-destructive/5 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
                  <Music className="h-8 w-8 text-destructive/50" />
                </div>
                <span className="text-[10px] font-medium text-destructive/70 uppercase tracking-wider">
                  Audio
                </span>
              </div>
              <AssetProgressOverlay asset={asset} job={currentJob} />
            </>
          ) : (
            // 成功状态 - 显示音频图标和时长
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Music className="h-8 w-8 text-primary/70" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Audio
              </span>
              {asset.duration && (
                <span className="text-xs text-muted-foreground mt-1">
                  {Math.round(asset.duration / 1000)}秒
                </span>
              )}
            </div>
          )
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
        ) : asset.displayUrl ? (
          <>
            {/* 加载骨架屏 */}
            {isImageLoading && (
              <div className="absolute inset-0 bg-muted animate-pulse" />
            )}
            <Image
              src={asset.displayUrl}
              alt={asset.name}
              fill
              className={cn(
                "object-cover transition-opacity duration-300",
                isImageLoading ? "opacity-0" : "opacity-100"
              )}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
              loading="lazy"
              onLoad={() => setIsImageLoading(false)}
            />
            {/* 视频播放图标 */}
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-background/80 rounded-full p-3 backdrop-blur-sm">
                  <Play className="h-6 w-6 text-foreground fill-foreground" />
                </div>
              </div>
            )}
            {/* 其他版本生成中指示器 - 与 AssetProgressOverlay 风格统一 */}
            {hasOtherGenerating && (
              <div className="absolute inset-0 pointer-events-none bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
                {/* 波纹动画背景 - 简化版 */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
                </div>

                {/* 主内容区域 */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  {/* 环形进度指示器 */}
                  <div className="relative w-12 h-12">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        className="text-muted/30"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 42}`}
                        strokeDashoffset={`${2 * Math.PI * 42 * (1 - (asset.otherVersionJob?.progress || 0) / 100)}`}
                        className="text-primary transition-all duration-500 ease-out"
                      />
                    </svg>
                    {/* 中心旋转图标 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                    </div>
                  </div>

                  {/* 状态文字 */}
                  <span className="text-xs font-medium text-foreground">
                    {t("generatingNewVersion")}
                  </span>
                </div>

                {/* 底部进度条 */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/50 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${asset.otherVersionJob?.progress || 0}%` }}
                  />
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

        {/* 版本数量标记 */}
        {!onSelectChange && <VersionCountBadge count={asset.versionCount} />}
        {onSelectChange && !isBatchSelected && !isHovered && <VersionCountBadge count={asset.versionCount} />}

        {/* 底部操作栏 */}
        {isHovered && !isGenerating && !isFailed && (
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-background/90 via-background/60 to-transparent pointer-events-none animate-in fade-in slide-in-from-bottom-1 duration-200">
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center gap-1 pointer-events-auto">
                {/* AI 编辑按钮 */}
                {canEdit && onEdit && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 bg-background/20 hover:bg-background/30 text-foreground backdrop-blur-sm transition-all hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(asset);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {t("aiEdit")}
                    </TooltipContent>
                  </Tooltip>
                )}
                {/* 引用按钮 */}
                {onReference && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 bg-background/20 hover:bg-background/30 text-foreground backdrop-blur-sm transition-all hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReference(asset);
                        }}
                      >
                        <AtSign className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      引用到对话
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
                        className="h-7 w-7 bg-background/20 hover:bg-background/30 text-foreground backdrop-blur-sm transition-all hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRegenerate(asset);
                        }}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {t("regenerate")}
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
                      {t("delete")}
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

