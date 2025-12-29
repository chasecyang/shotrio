"use client";

import { memo, useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AlertCircle, Coins, Plus, Check, X, Image as ImageIcon, Loader2, Film, Camera, Clock } from "lucide-react";
import type { PendingActionInfo } from "@/lib/services/agent-engine";
import { formatParametersForConfirmation, ENUM_VALUE_LABELS } from "@/lib/utils/agent-params-formatter";
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

  // 判断操作类型
  const isGenerateAssets = action.functionCall.name === "generate_assets";
  const isCreateShots = action.functionCall.name === "create_shots";
  const isUpdateShots = action.functionCall.name === "update_shots";

  // 格式化参数（针对特殊操作特殊处理）
  const formattedParams = useMemo(() => {
    if (isGenerateAssets || isCreateShots || isUpdateShots) {
      // 这些操作需要单独处理数组
      return [];
    } else {
      // 其他操作：使用标准格式化
      return formatParametersForConfirmation(action.functionCall.arguments);
    }
  }, [action.functionCall.arguments, isGenerateAssets, isCreateShots, isUpdateShots]);

  // 解析生成素材的assets数组
  const generationAssets = useMemo(() => {
    if (!isGenerateAssets) return null;
    
    try {
      const assetsArg = action.functionCall.arguments.assets;
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
  }, [isGenerateAssets, action.functionCall.arguments]);

  // 解析创建分镜的shots数组
  const parsedShots = useMemo(() => {
    if (!isCreateShots) return null;
    
    try {
      const shotsArg = action.functionCall.arguments.shots;
      let shotsArray: Array<Record<string, unknown>>;

      // 兼容数组和JSON字符串
      if (Array.isArray(shotsArg)) {
        shotsArray = shotsArg;
      } else if (typeof shotsArg === "string") {
        shotsArray = JSON.parse(shotsArg);
      } else {
        return null;
      }

      if (!Array.isArray(shotsArray)) return null;

      return shotsArray.map((shot: Record<string, unknown>, index: number) => {
        const description = shot.description || "-";
        const shotSize = shot.shotSize as string || "-";
        const cameraMovement = shot.cameraMovement as string || "static";
        // Agent传的是秒，直接使用，不需要除以1000
        const durationSeconds = typeof shot.duration === "number" ? shot.duration : 3;
        const order = typeof shot.order === "number" ? shot.order : index + 1;
        const visualPrompt = shot.visualPrompt as string || "";
        
        // 翻译枚举值
        const shotSizeLabel = ENUM_VALUE_LABELS.shotSize?.[shotSize] || shotSize;
        const cameraMovementLabel = ENUM_VALUE_LABELS.cameraMovement?.[cameraMovement] || cameraMovement;

        return {
          order,
          description: description as string,
          shotSize: shotSize as string,
          shotSizeLabel,
          cameraMovement: cameraMovement as string,
          cameraMovementLabel,
          duration: durationSeconds * 1000, // 保留毫秒字段用于内部计算（如果需要）
          durationSeconds, // 直接用秒显示
          visualPrompt: visualPrompt as string,
        };
      });
    } catch (error) {
      console.error("解析shots数组失败:", error);
      return null;
    }
  }, [isCreateShots, action.functionCall.arguments]);

  // 解析修改分镜的updates数组
  const parsedShotUpdates = useMemo(() => {
    if (!isUpdateShots) return null;
    
    try {
      const updatesArg = action.functionCall.arguments.updates;
      let updatesArray: Array<Record<string, unknown>>;

      // 兼容数组和JSON字符串
      if (Array.isArray(updatesArg)) {
        updatesArray = updatesArg;
      } else if (typeof updatesArg === "string") {
        updatesArray = JSON.parse(updatesArg);
      } else {
        return null;
      }

      if (!Array.isArray(updatesArray)) return null;

      return updatesArray.map((update: Record<string, unknown>) => {
        const shotId = update.shotId as string || "-";
        const changes: Array<{ key: string; label: string; value: string }> = [];

        // 收集所有修改项
        if (update.description !== undefined) {
          changes.push({ key: "description", label: "描述", value: String(update.description) });
        }
        if (update.shotSize !== undefined) {
          const shotSize = update.shotSize as string;
          const label = ENUM_VALUE_LABELS.shotSize?.[shotSize] || shotSize;
          changes.push({ key: "shotSize", label: "景别", value: label });
        }
        if (update.cameraMovement !== undefined) {
          const cameraMovement = update.cameraMovement as string;
          const label = ENUM_VALUE_LABELS.cameraMovement?.[cameraMovement] || cameraMovement;
          changes.push({ key: "cameraMovement", label: "运镜", value: label });
        }
        if (update.duration !== undefined) {
          // Agent传的是秒，直接显示
          const durationSeconds = typeof update.duration === "number" ? update.duration : 3;
          changes.push({ key: "duration", label: "时长", value: `${durationSeconds}秒` });
        }
        if (update.visualPrompt !== undefined) {
          changes.push({ key: "visualPrompt", label: "视觉提示词", value: String(update.visualPrompt) });
        }

        return {
          shotId,
          changes,
        };
      });
    } catch (error) {
      console.error("解析updates数组失败:", error);
      return null;
    }
  }, [isUpdateShots, action.functionCall.arguments]);

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
          ) : isCreateShots ? (
            /* 创建分镜：横向滚动显示 */
            parsedShots && parsedShots.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {parsedShots.map((shot, index) => (
                  <div key={index} className="flex-shrink-0 w-72 rounded-md bg-background/50 border border-border/50 p-2.5">
                    <div className="space-y-2">
                      {/* 分镜编号 */}
                      <div className="flex items-center gap-2 pb-1.5 border-b border-border/30">
                        <Film className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold text-foreground">分镜 #{shot.order}</span>
                      </div>
                      
                      {/* 分镜参数 */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Camera className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">景别:</span>
                          <span className="text-xs text-foreground">{shot.shotSizeLabel}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Camera className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">运镜:</span>
                          <span className="text-xs text-foreground">{shot.cameraMovementLabel}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">时长:</span>
                          <span className="text-xs text-foreground">{shot.durationSeconds}秒</span>
                        </div>
                      </div>
                      
                      {/* 描述 */}
                      {shot.description && shot.description !== "-" && (
                        <div className="pt-1.5 border-t border-border/30">
                          <span className="text-xs font-medium text-muted-foreground block mb-1">描述:</span>
                          <p className="text-xs text-foreground break-words line-clamp-3">{shot.description}</p>
                        </div>
                      )}
                      
                      {/* 视觉提示词（如果有） */}
                      {shot.visualPrompt && (
                        <div className="pt-1.5 border-t border-border/30">
                          <span className="text-xs font-medium text-muted-foreground block mb-1">视觉提示:</span>
                          <p className="text-xs text-muted-foreground break-words line-clamp-2">{shot.visualPrompt}</p>
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
          ) : isUpdateShots ? (
            /* 修改分镜：横向滚动显示 */
            parsedShotUpdates && parsedShotUpdates.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {parsedShotUpdates.map((update, index) => (
                  <div key={index} className="flex-shrink-0 w-72 rounded-md bg-background/50 border border-border/50 p-2.5">
                    <div className="space-y-2">
                      {/* 分镜ID标题 */}
                      <div className="flex items-center gap-2 pb-1.5 border-b border-border/30">
                        <Film className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold text-foreground truncate">分镜</span>
                      </div>
                      
                      {/* 修改项列表 */}
                      <div className="space-y-1.5">
                        {update.changes.map((change, changeIndex) => (
                          <div key={changeIndex} className="flex items-start gap-2">
                            <span className="text-xs font-medium text-muted-foreground shrink-0">
                              {change.label}:
                            </span>
                            <span className="text-xs text-foreground break-words line-clamp-2">
                              {change.value}
                            </span>
                          </div>
                        ))}
                      </div>
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
