"use client";

import { memo, useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AlertCircle, Coins, Plus, Check, X, Image as ImageIcon, Loader2 } from "lucide-react";
import type { PendingActionInfo } from "@/lib/services/agent-engine";
import { formatParametersForConfirmation } from "@/lib/utils/agent-params-formatter";
import { PurchaseDialog } from "@/components/credits/purchase-dialog";
import { getAssetsByIds } from "@/lib/actions/asset";
import Image from "next/image";
import { useEditor } from "../editor-context";

interface PendingActionMessageProps {
  action: PendingActionInfo;
  onConfirm: (actionId: string) => void;
  onCancel: (actionId: string) => void;
  currentBalance?: number;
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
  }, [assetIds]);

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
  }, [jobs, assetIds]);

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

// 向后兼容的别名
const ReferenceImages = AssetPreview;

export const PendingActionMessage = memo(function PendingActionMessage({
  action,
  onConfirm,
  onCancel,
  currentBalance,
}: PendingActionMessageProps) {
  const t = useTranslations();
  const totalCost = action.creditCost?.total || 0;
  const insufficientBalance = currentBalance !== undefined && totalCost > currentBalance;
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);

  // 在 Agent 架构中，PendingActionInfo 只在需要确认时存在
  // 不需要 status 字段，因为它的存在本身就表示 "pending" 状态
  const borderColor = "border-primary/20";
  const bgColor = "bg-accent/30";
  const iconBg = "bg-primary/10";
  const iconColor = "text-primary";

  // 判断是否为生成素材操作
  const isGenerateAsset = action.functionCall.name === "generate_asset";
  const isBatchGenerateAssets = action.functionCall.name === "batch_generate_assets";

  // 格式化参数（针对生成素材操作特殊处理）
  const formattedParams = useMemo(() => {
    if (isGenerateAsset) {
      // generate_asset: 过滤projectId，展示prompt、name、tags、sourceAssetIds
      return formatParametersForConfirmation(action.functionCall.arguments);
    } else if (isBatchGenerateAssets) {
      // batch_generate_assets: 返回空数组，因为需要单独处理assets数组
      return [];
    } else {
      // 其他操作：使用标准格式化
      return formatParametersForConfirmation(action.functionCall.arguments);
    }
  }, [action.functionCall.arguments, isGenerateAsset, isBatchGenerateAssets]);

  // 提取单个生成素材的参考图ID
  const singleAssetSourceIds = useMemo(() => {
    if (!isGenerateAsset) return [];
    const sourceAssetIds = action.functionCall.arguments.sourceAssetIds;
    if (Array.isArray(sourceAssetIds)) {
      return sourceAssetIds;
    }
    if (typeof sourceAssetIds === "string") {
      try {
        const parsed = JSON.parse(sourceAssetIds);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // 不是JSON，忽略
      }
    }
    return [];
  }, [isGenerateAsset, action.functionCall.arguments]);

  // 解析批量生成素材的assets数组
  const batchAssets = useMemo(() => {
    if (!isBatchGenerateAssets) return null;
    
    try {
      const assetsStr = action.functionCall.arguments.assets;
      if (typeof assetsStr === "string") {
        const parsed = JSON.parse(assetsStr);
        if (Array.isArray(parsed)) {
          return parsed.map((asset: any) => {
            const prompt = asset.prompt || "-";
            const truncatedPrompt = prompt !== "-" && prompt.length > 100 
              ? prompt.slice(0, 100) + "..." 
              : prompt;
            
            // 提取参考图ID
            let sourceAssetIds: string[] = [];
            if (Array.isArray(asset.sourceAssetIds)) {
              sourceAssetIds = asset.sourceAssetIds;
            } else if (typeof asset.sourceAssetIds === "string") {
              try {
                const parsed = JSON.parse(asset.sourceAssetIds);
                if (Array.isArray(parsed)) {
                  sourceAssetIds = parsed;
                }
              } catch {
                // 不是JSON，忽略
              }
            }
            
            return {
              name: asset.name || "-",
              prompt: truncatedPrompt,
              tags: Array.isArray(asset.tags) 
                ? asset.tags.join(", ") 
                : (typeof asset.tags === "string" ? asset.tags : "-"),
              sourceAssetIds,
            };
          });
        }
      }
    } catch (error) {
      console.error("解析批量生成素材参数失败:", error);
    }
    return null;
  }, [isBatchGenerateAssets, action.functionCall.arguments]);

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
              {action.functionCall.displayName || action.functionCall.name}
            </p>
          </div>
        </div>

        {/* Function Call Details */}
        <div className="space-y-2 pl-9">
          {isBatchGenerateAssets ? (
            /* 批量生成素材：为每个素材显示一个卡片 */
            batchAssets && batchAssets.length > 0 ? (
              <div className="space-y-2">
                {batchAssets.map((asset, index) => (
                  <div key={index} className="rounded-md bg-background/50 border border-border/50 p-2.5">
                    <div className="space-y-1.5">
                      {asset.name && asset.name !== "-" && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">名称:</span>
                          <span className="text-xs text-foreground">{asset.name}</span>
                        </div>
                      )}
                      {asset.prompt && asset.prompt !== "-" && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-medium text-muted-foreground shrink-0">提示词:</span>
                          <span className="text-xs text-foreground break-words">{asset.prompt}</span>
                        </div>
                      )}
                      {asset.tags && asset.tags !== "-" && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">标签:</span>
                          <span className="text-xs text-foreground">{asset.tags}</span>
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
          ) : (
            /* 单个操作：使用格式化参数展示 */
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
                  {/* 如果有参考图但不在格式化参数中（被过滤了），单独显示 */}
                  {isGenerateAsset && singleAssetSourceIds.length > 0 && 
                   !formattedParams.some(p => p.key === "sourceAssetIds") && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">参考图:</span>
                        <span className="text-xs text-foreground">{singleAssetSourceIds.length}张</span>
                      </div>
                      <AssetPreview assetIds={singleAssetSourceIds} />
                    </div>
                  )}
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
              onClick={() => onCancel(action.id)}
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              {t('editor.agent.pendingAction.reject')}
            </Button>
            <Button
              onClick={() => onConfirm(action.id)}
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
