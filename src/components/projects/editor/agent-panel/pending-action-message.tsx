"use client";

import { memo, useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AlertCircle, Coins, Plus, Check, X, Image as ImageIcon, Loader2, Film, Camera, Clock, Video } from "lucide-react";
import type { CreditCost } from "@/lib/utils/credit-calculator";
import { 
  formatParametersForConfirmation, 
  ENUM_VALUE_LABELS,
  type KlingO1ConfigDisplay,
  type PromptPart,
  parsePromptReferences,
  formatKlingO1ConfigSync
} from "@/lib/utils/agent-params-formatter";
import { PurchaseDialog } from "@/components/credits/purchase-dialog";
import { getAssetsByIds } from "@/lib/actions/asset";
import Image from "next/image";
import { useEditor } from "../editor-context";

interface PendingActionMessageProps {
  functionCall: {
    id: string;
    name: string;
    displayName?: string;
    arguments: Record<string, unknown>;
    category: string;
  };
  message: string;
  creditCost?: CreditCost;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  currentBalance?: number;
}

// Prompt高亮组件
function PromptWithHighlights({ 
  prompt
}: { 
  prompt: string;
}) {
  const parts = parsePromptReferences(prompt);
  
  return (
    <div className="whitespace-pre-wrap text-xs leading-relaxed">
      {parts.map((part, i) => 
        part.isReference ? (
          <span key={i} className="font-medium text-primary bg-primary/10 px-1 rounded">
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </div>
  );
}

// 图片缩略图组件
function ImageThumbnail({ 
  image 
}: { 
  image: { imageUrl: string; label: string; type: string; apiReference: string } 
}) {
  const [imageError, setImageError] = useState(false);
  
  const getTypeIcon = () => {
    switch (image.type) {
      case 'element':
        return <Camera className="h-3 w-3 text-white" />;
      case 'start_frame':
        return <Film className="h-3 w-3 text-white" />;
      case 'reference':
        return <ImageIcon className="h-3 w-3 text-white" />;
      default:
        return null;
    }
  };

  const getTypeLabel = () => {
    switch (image.type) {
      case 'element':
        return '角色';
      case 'reference':
        return '参考';
      default:
        return '';
    }
  };
  
  return (
    <div className="space-y-1">
      <div className="relative group aspect-square rounded border overflow-hidden bg-muted">
        {!imageError ? (
          <Image 
            src={image.imageUrl}
            alt={image.label}
            fill
            className="object-cover"
            sizes="80px"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        {/* 类型标识 */}
        <div className="absolute top-1 right-1 bg-black/60 rounded px-1 py-0.5">
          <div className="flex items-center gap-0.5">
            {getTypeIcon()}
            <span className="text-[9px] text-white font-medium">{getTypeLabel()}</span>
          </div>
        </div>
      </div>
      {/* Label标签 */}
      <div className="text-[10px] text-center text-muted-foreground truncate px-0.5" title={image.label}>
        {image.label}
      </div>
    </div>
  );
}

// 参数项组件
function ParamItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}:</span>
      <span className="text-xs text-foreground">{value}</span>
    </div>
  );
}

// Kling O1 配置展示组件
function KlingO1ConfigDisplay({ config }: { config: KlingO1ConfigDisplay }) {
  // 按API引用分组图片
  const groupedImages = useMemo(() => {
    const groups: Record<string, typeof config.images> = {};
    config.images.forEach(img => {
      const ref = img.apiReference;
      if (!groups[ref]) {
        groups[ref] = [];
      }
      groups[ref].push(img);
    });
    return groups;
  }, [config.images]);

  // 按顺序排列分组（Element1, Element2..., Image1, Image2...）
  const sortedGroups = useMemo(() => {
    return Object.entries(groupedImages).sort(([a], [b]) => {
      const getOrder = (ref: string) => {
        const match = ref.match(/@(Element|Image)(\d+)/);
        if (!match) return 999;
        const type = match[1] === 'Element' ? 0 : 1; // Element优先
        const num = parseInt(match[2]);
        return type * 1000 + num;
      };
      return getOrder(a) - getOrder(b);
    });
  }, [groupedImages]);

  return (
    <div className="space-y-3">
      {/* Prompt区域 */}
      {config.prompt && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5" />
            视频描述
          </div>
          <div className="bg-background/50 border border-border/50 rounded-md p-2.5 max-h-32 overflow-y-auto">
            <PromptWithHighlights prompt={config.prompt} />
          </div>
        </div>
      )}
      
      {/* 关联图片 - 按分组横向展示 */}
      {config.images.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" />
            关联图片 ({config.images.length}张)
          </div>
          {/* 横向滚动容器 */}
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            {sortedGroups.map(([apiRef, images]) => (
              <div key={apiRef} className="flex-shrink-0">
                {/* 分组标题 */}
                <div className="text-[10px] font-medium text-primary mb-1 font-mono">
                  {apiRef}
                  {images.length > 1 && <span className="text-muted-foreground ml-1">({images.length}张)</span>}
                </div>
                {/* 该分组的图片 - 横向排列 */}
                <div className="flex gap-2">
                  {images.map((img, index) => (
                    <div key={`${img.imageUrl}-${index}`} className="w-20">
                      <ImageThumbnail image={img} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 其他参数 */}
      <div className="bg-background/50 border border-border/50 rounded-md p-2.5">
        <div className="grid grid-cols-2 gap-2">
          <ParamItem label="时长" value={config.duration} />
          <ParamItem label="宽高比" value={config.aspectRatio} />
        </div>
      </div>
    </div>
  );
}

// 素材预览组件（支持自动刷新）
function AssetPreview({ assetIds }: { assetIds: string[] }) {
  const [assets, setAssets] = useState<Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    thumbnailUrl: string | null;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 使用 ref 跟踪当前请求的 assetIds，防止竞态条件
  const currentRequestRef = useRef<string>("");
  // 获取 Editor Context 中的 jobs 状态
  const { jobs } = useEditor();

  // 加载素材数据
  const loadAssets = async (requestId: string) => {
    if (assetIds.length === 0) {
      if (currentRequestRef.current === requestId) {
        setIsLoading(false);
      }
      return;
    }

    try {
      const result = await getAssetsByIds(assetIds);
      // 检查请求是否仍然有效（assetIds 没有变化）
      if (currentRequestRef.current === requestId) {
        if (result.success && result.assets) {
          setAssets(result.assets);
        }
        setIsLoading(false);
      }
    } catch (error) {
      // 只有在当前请求仍然有效时才更新状态
      if (currentRequestRef.current === requestId) {
        console.error("加载素材失败:", error);
        setIsLoading(false);
      }
    }
  };

  // 初始加载
  useEffect(() => {
    const requestId = JSON.stringify(assetIds.sort());
    currentRequestRef.current = requestId;

    // 立即重置状态，避免显示旧的图片
    setAssets([]);
    setIsLoading(true);

    loadAssets(requestId);

    // 清理函数：标记请求已取消
    return () => {
      currentRequestRef.current = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetIds]); // loadAssets 故意省略，使用 requestId 控制

  // 监听 jobs 变化，自动刷新相关素材
  useEffect(() => {
    // 检查是否有相关的 asset_image_generation 任务完成
    const completedAssetJobs = jobs.filter(
      (job) =>
        job.type === "asset_image_generation" &&
        job.status === "completed" &&
        job.inputData
    );

    if (completedAssetJobs.length === 0) return;

    // 检查是否有我们关心的 assetId
    const shouldRefresh = completedAssetJobs.some((job) => {
      try {
        const inputData = JSON.parse(job.inputData || "{}");
        return assetIds.includes(inputData.assetId);
      } catch {
        return false;
      }
    });

    if (shouldRefresh) {
      // 重新加载素材数据
      const requestId = currentRequestRef.current;
      if (requestId) {
        loadAssets(requestId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, assetIds]); // loadAssets 故意省略，使用 requestId 控制

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>加载素材...</span>
      </div>
    );
  }

  if (assets.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="relative group rounded-md overflow-hidden border border-border/50 bg-background/50"
        >
          <div className="relative w-16 h-16">
            {asset.imageUrl ? (
              <Image
                src={asset.thumbnailUrl || asset.imageUrl}
                alt={asset.name}
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
          <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-[10px] text-white truncate">{asset.name}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export const PendingActionMessage = memo(function PendingActionMessage({
  functionCall,
  message,
  creditCost,
  onConfirm,
  onCancel,
  currentBalance,
}: PendingActionMessageProps) {
  const t = useTranslations();
  const totalCost = creditCost?.total || 0;
  const insufficientBalance = currentBalance !== undefined && totalCost > currentBalance;
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);

  const borderColor = "border-primary/20";
  const bgColor = "bg-accent/30";
  const iconBg = "bg-primary/10";
  const iconColor = "text-primary";

  // 判断操作类型
  const isGenerateAssets = functionCall.name === "generate_assets";
  const isGenerateVideo = functionCall.name === "generate_video";

  // 格式化参数（针对特殊操作特殊处理）
  const formattedParams = useMemo(() => {
    if (isGenerateAssets || isGenerateVideo) {
      // 这些操作需要单独处理数组
      return [];
    } else {
      // 其他操作：使用标准格式化
      return formatParametersForConfirmation(functionCall.arguments);
    }
  }, [functionCall.arguments, isGenerateAssets, isGenerateVideo]);

  // 解析生成素材的assets数组
  const generationAssets = useMemo(() => {
    if (!isGenerateAssets) return null;
    
    try {
      const assetsArg = functionCall.arguments.assets;
      let assetsArray: Array<Record<string, unknown>>;

      // 兼容数组和JSON字符串
      if (Array.isArray(assetsArg)) {
        assetsArray = assetsArg;
      } else if (typeof assetsArg === "string") {
        assetsArray = JSON.parse(assetsArg);
      } else {
        return null;
      }

      if (!Array.isArray(assetsArray)) return null;

      return assetsArray.map((asset: Record<string, unknown>) => {
        const prompt = asset.prompt || "-";
        const name = asset.name || "未命名";
        const tags = Array.isArray(asset.tags) 
          ? asset.tags.join(", ") 
          : (typeof asset.tags === "string" ? asset.tags : "-");
        
        // 提取sourceAssetIds（用于图生图）
        let sourceIds: string[] = [];
        if (Array.isArray(asset.sourceAssetIds)) {
          sourceIds = asset.sourceAssetIds as string[];
        } else if (typeof asset.sourceAssetIds === "string") {
          try {
            const parsed = JSON.parse(asset.sourceAssetIds);
            if (Array.isArray(parsed)) {
              sourceIds = parsed;
            }
          } catch {
            // 不是JSON，忽略
          }
        }

        return {
          name: name as string,
          prompt: prompt as string,
          tags: tags as string,
          sourceAssetIds: sourceIds,
        };
      });
    } catch (error) {
      console.error("解析assets数组失败:", error);
      return null;
    }
  }, [isGenerateAssets, functionCall.arguments]);

  // 解析视频生成的klingO1Config
  const klingO1ConfigDisplay = useMemo(() => {
    if (!isGenerateVideo) return null;
    
    try {
      const klingO1Config = functionCall.arguments.klingO1Config;
      
      if (!klingO1Config || typeof klingO1Config !== 'object') {
        return null;
      }
      
      // 使用formatKlingO1ConfigSync格式化配置
      // 注意：这里没有URL到label的映射，会使用默认标签
      return formatKlingO1ConfigSync(klingO1Config);
    } catch (error) {
      console.error("解析klingO1Config失败:", error);
      return null;
    }
  }, [isGenerateVideo, functionCall.arguments]);

  return (
    <div className={`rounded-lg backdrop-blur-sm border overflow-hidden ${bgColor} ${borderColor}`}>
      <div className="p-3 space-y-3">
        {/* Header with Icon and Title */}
        <div className="flex items-start gap-2.5">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full shrink-0 mt-0.5 ${iconBg}`}>
            <AlertCircle className={`h-4 w-4 ${iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {functionCall.displayName || functionCall.name}
            </p>
          </div>
        </div>

        {/* Function Call Details */}
        <div className="space-y-2 pl-9">
          {isGenerateAssets ? (
            /* 生成素材：横向滚动显示 */
            generationAssets && generationAssets.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {generationAssets.map((asset, index) => (
                  <div key={index} className="flex-shrink-0 w-72 rounded-md bg-background/50 border border-border/50 p-2.5">
                    <div className="space-y-1.5">
                      {asset.name && asset.name !== "-" && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">名称:</span>
                          <span className="text-xs text-foreground truncate">{asset.name}</span>
                        </div>
                      )}
                      {asset.prompt && asset.prompt !== "-" && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-medium text-muted-foreground shrink-0">提示词:</span>
                          <span className="text-xs text-foreground break-words line-clamp-3">{asset.prompt}</span>
                        </div>
                      )}
                      {asset.tags && asset.tags !== "-" && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">标签:</span>
                          <span className="text-xs text-foreground truncate">{asset.tags}</span>
                        </div>
                      )}
                      {asset.sourceAssetIds && asset.sourceAssetIds.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground">参考图:</span>
                            <span className="text-xs text-foreground">{asset.sourceAssetIds.length}张</span>
                          </div>
                          <AssetPreview assetIds={asset.sourceAssetIds} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Fallback: 如果解析失败，使用标准格式化 */
              formattedParams.length > 0 && (
                <div className="rounded-md bg-background/50 border border-border/50 p-2.5">
                  <div className="space-y-1.5">
                    {formattedParams.map((param) => (
                      <div key={param.key} className="flex items-start gap-2">
                        <span className="text-xs font-medium text-muted-foreground shrink-0">
                          {param.label}:
                        </span>
                        <span className="text-xs text-foreground break-words">
                          {param.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )
          ) : isGenerateVideo ? (
            /* 生成视频：显示Kling O1配置 */
            klingO1ConfigDisplay ? (
              <KlingO1ConfigDisplay config={klingO1ConfigDisplay} />
            ) : (
              /* Fallback: 如果解析失败，使用标准格式化 */
              formattedParams.length > 0 && (
                <div className="rounded-md bg-background/50 border border-border/50 p-2.5">
                  <div className="space-y-1.5">
                    {formattedParams.map((param) => (
                      <div key={param.key} className="space-y-1.5">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-medium text-muted-foreground shrink-0">
                            {param.label}:
                          </span>
                          <span className="text-xs text-foreground break-words">
                            {param.value}
                          </span>
                        </div>
                        {/* 如果是素材引用参数，显示图片预览 */}
                        {param.isAssetReference && param.assetIds && param.assetIds.length > 0 && (
                          <div className="pl-0 pt-1">
                            <AssetPreview assetIds={param.assetIds} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            )
          ) : (
            /* 其他操作：使用格式化参数展示 */
            formattedParams.length > 0 && (
              <div className="rounded-md bg-background/50 border border-border/50 p-2.5">
                <div className="space-y-1.5">
                  {formattedParams.map((param) => (
                    <div key={param.key} className="space-y-1.5">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-muted-foreground shrink-0">
                          {param.label}:
                        </span>
                        <span className="text-xs text-foreground break-words">
                          {param.value}
                        </span>
                      </div>
                      {/* 如果是素材引用参数，显示图片预览 */}
                      {param.isAssetReference && param.assetIds && param.assetIds.length > 0 && (
                        <div className="pl-0 pt-1">
                          <AssetPreview assetIds={param.assetIds} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer: Credit Cost and Actions */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
          {/* Credit Cost */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background text-xs">
            <Coins className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">{t('agent.credits.total')}</span>
            <span className="font-semibold text-foreground">{totalCost}</span>
            <span className="text-muted-foreground">{t('credits.creditsUnit')}</span>
            {insufficientBalance && (
              <span className="text-red-600 dark:text-red-400 ml-1">
                ({t('agent.credits.insufficient')}: {currentBalance}<button
                  onClick={() => setShowPurchaseDialog(true)}
                  className="inline-flex items-center justify-center w-4 h-4 ml-0.5 rounded-sm text-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
                  title={t('credits.addCredits')}
                  type="button"
                >
                  <Plus className="w-3 h-3" />
                </button>)
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => onCancel(functionCall.id)}
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              {t('editor.agent.pendingAction.reject')}
            </Button>
            <Button
              onClick={() => onConfirm(functionCall.id)}
              disabled={insufficientBalance}
              size="sm"
              className="h-7 px-3 text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              {t('editor.agent.pendingAction.confirm')}
            </Button>
          </div>
        </div>
      </div>

      {/* Purchase Dialog */}
      <PurchaseDialog
        open={showPurchaseDialog}
        onOpenChange={setShowPurchaseDialog}
      />
    </div>
  );
});
