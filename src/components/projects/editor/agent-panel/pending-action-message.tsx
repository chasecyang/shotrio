"use client";

import { memo, useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { 
  AlertCircle, 
  Coins, 
  Plus, 
  Check, 
  X, 
  Image as ImageIcon, 
  Loader2, 
  Maximize2 
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CreditCost } from "@/lib/utils/credit-calculator";
import { 
  formatParametersForConfirmation, 
  parsePromptReferences
} from "@/lib/utils/agent-params-formatter";
import { PurchaseDialog } from "@/components/credits/purchase-dialog";
import { getAssetsByIds } from "@/lib/actions/asset";
import { getArtStyleById } from "@/lib/actions/art-style/queries";
import Image from "next/image";
import { useEditor } from "../editor-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  onConfirm: (id: string, modifiedParams?: Record<string, unknown>) => void; // 🆕 支持传递修改后的参数
  onCancel: (id: string) => void;
  currentBalance?: number;
  isConfirming?: boolean;
  isRejecting?: boolean;
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

    // 检查是否有我们关心的 assetId（使用外键）
    const shouldRefresh = completedAssetJobs.some((job) => {
      return job.assetId ? assetIds.includes(job.assetId) : false;
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
  isConfirming = false,
  isRejecting = false,
}: PendingActionMessageProps) {
  const t = useTranslations();
  const totalCost = creditCost?.total || 0;
  const insufficientBalance = currentBalance !== undefined && totalCost > currentBalance;
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [artStyleName, setArtStyleName] = useState<string | null>(null);
  
  // 🆕 编辑状态
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editedParams, setEditedParams] = useState<Record<string, unknown>>(functionCall.arguments);
  
  // 计算整体 loading 状态
  const isLoading = isConfirming || isRejecting;

  const borderColor = "border-primary/20";
  const bgColor = "bg-accent/30";
  const iconBg = "bg-primary/10";
  const iconColor = "text-primary";

  // 判断操作类型
  const isGenerateAssets = functionCall.name === "generate_image_asset";
  const isGenerateVideo = functionCall.name === "generate_video_asset";
  const isCreateTextAsset = functionCall.name === "create_text_asset";
  const isSetArtStyle = functionCall.name === "set_art_style";

  // 格式化参数（针对特殊操作特殊处理）
  const formattedParams = useMemo(() => {
    if (isGenerateAssets || isGenerateVideo || isSetArtStyle || isCreateTextAsset) {
      // 这些操作需要单独处理
      return [];
    } else {
      // 其他操作：使用标准格式化
      return formatParametersForConfirmation(functionCall.arguments);
    }
  }, [functionCall.arguments, isGenerateAssets, isGenerateVideo, isSetArtStyle, isCreateTextAsset]);

  // 解析生成素材的assets数组（从editedParams读取，支持编辑）
  const generationAssets = useMemo(() => {
    if (!isGenerateAssets) return null;
    
    try {
      const assetsArg = editedParams.assets;
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
  }, [isGenerateAssets, editedParams]);

  // 获取美术风格名称
  useEffect(() => {
    if (!isSetArtStyle) return;
    
    const styleId = functionCall.arguments.styleId as string;
    if (!styleId) return;

    // 异步获取美术风格名称
    getArtStyleById(styleId).then((style) => {
      if (style) {
        setArtStyleName(style.name);
      }
    }).catch((error) => {
      console.error("获取美术风格名称失败:", error);
    });
  }, [isSetArtStyle, functionCall.arguments.styleId]);

  // 渲染 Markdown 预览（截取前N行）
  const renderMarkdownPreview = (content: string, maxLines: number = 5) => {
    const lines = content.split('\n');
    const preview = lines.slice(0, maxLines).join('\n');
    const hasMore = lines.length > maxLines;
    
    return (
      <div className="space-y-1">
        <div className="text-xs text-foreground/80 max-h-32 overflow-hidden">
          <MarkdownRenderer content={preview} />
        </div>
        {hasMore && (
          <p className="text-xs text-muted-foreground italic">
            ...还有 {lines.length - maxLines} 行
          </p>
        )}
      </div>
    );
  };

  const renderEditForm = () => {
    if (isGenerateAssets) {
      return (
        generationAssets && generationAssets.length > 0 && (
          <div className="space-y-6">
            {generationAssets.map((asset, index) => (
              <div key={index} className="rounded-md border p-4 space-y-4">
                <div className="font-medium text-sm flex items-center gap-2">
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">#{index + 1}</span>
                  {asset.name}
                </div>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>名称</Label>
                    <Input
                      value={asset.name}
                      onChange={(e) => {
                        const newAssets = [...generationAssets];
                        newAssets[index] = { ...newAssets[index], name: e.target.value };
                        setEditedParams({ ...editedParams, assets: newAssets });
                      }}
                      placeholder="资产名称"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>提示词 *</Label>
                    <Textarea
                      value={asset.prompt}
                      onChange={(e) => {
                        const newAssets = [...generationAssets];
                        newAssets[index] = { ...newAssets[index], prompt: e.target.value };
                        setEditedParams({ ...editedParams, assets: newAssets });
                      }}
                      className="min-h-[100px]"
                      placeholder="描述你想生成的图片"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>标签</Label>
                    <Input
                      value={asset.tags}
                      onChange={(e) => {
                        const newAssets = [...generationAssets];
                        newAssets[index] = { ...newAssets[index], tags: e.target.value };
                        setEditedParams({ ...editedParams, assets: newAssets });
                      }}
                      placeholder="用逗号分隔，如: 角色, 主角"
                    />
                  </div>
                  {asset.sourceAssetIds && asset.sourceAssetIds.length > 0 && (
                    <div className="space-y-2">
                      <Label>参考图 ({asset.sourceAssetIds.length}张)</Label>
                      <AssetPreview assetIds={asset.sourceAssetIds} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      );
    }
    
    if (isGenerateVideo) {
      return (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>提示词 *</Label>
            <Textarea
              value={editedParams.prompt as string || ""}
              onChange={(e) => setEditedParams({ ...editedParams, prompt: e.target.value })}
              className="min-h-[100px]"
              placeholder="描述视频内容和镜头运动"
            />
          </div>
          {editedParams.title !== undefined && (
            <div className="grid gap-2">
              <Label>标题</Label>
              <Input
                value={editedParams.title as string || ""}
                onChange={(e) => setEditedParams({ ...editedParams, title: e.target.value })}
                placeholder="视频标题"
              />
            </div>
          )}
          {editedParams.duration !== undefined && (
            <div className="grid gap-2">
              <Label>时长</Label>
              <Select
                value={editedParams.duration as string || "5"}
                onValueChange={(value) => setEditedParams({ ...editedParams, duration: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5秒</SelectItem>
                  <SelectItem value="10">10秒</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {editedParams.aspect_ratio !== undefined && (
            <div className="grid gap-2">
              <Label>宽高比</Label>
              <Select
                value={editedParams.aspect_ratio as string || "16:9"}
                onValueChange={(value) => setEditedParams({ ...editedParams, aspect_ratio: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 (宽屏)</SelectItem>
                  <SelectItem value="9:16">9:16 (竖屏)</SelectItem>
                  <SelectItem value="1:1">1:1 (方形)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {/* 显示参考图 */}
          {formattedParams.map((param) => (
            param.isAssetReference && param.assetIds && param.assetIds.length > 0 && (
              <div key={param.key} className="space-y-2">
                <Label>{param.label}</Label>
                <AssetPreview assetIds={param.assetIds} />
              </div>
            )
          ))}
        </div>
      );
    }

    if (isCreateTextAsset) {
      return (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>名称 *</Label>
            <Input
              value={editedParams.name as string || ""}
              onChange={(e) => setEditedParams({ ...editedParams, name: e.target.value })}
              placeholder="文本资产名称，如'主角小传'、'第一幕剧本'"
            />
          </div>
          
          <div className="space-y-2">
            <Label>内容 *</Label>
            <Tabs defaultValue="edit" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="edit">编辑</TabsTrigger>
                <TabsTrigger value="preview">预览</TabsTrigger>
              </TabsList>
              <TabsContent value="edit" className="mt-2">
                <Textarea
                  value={editedParams.content as string || ""}
                  onChange={(e) => setEditedParams({ ...editedParams, content: e.target.value })}
                  className="min-h-[300px] font-mono text-sm"
                  placeholder="支持 Markdown 语法..."
                />
              </TabsContent>
              <TabsContent value="preview" className="mt-2">
                <div className="min-h-[300px] max-h-[400px] border rounded-md p-4 bg-muted/30 overflow-auto">
                  <MarkdownRenderer content={editedParams.content as string || "*暂无内容*"} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          <div className="grid gap-2">
            <Label>标签</Label>
            <Input
              value={
                Array.isArray(editedParams.tags) 
                  ? editedParams.tags.join(", ") 
                  : (editedParams.tags as string || "")
              }
              onChange={(e) => {
                const tagsStr = e.target.value;
                const tagsArray = tagsStr.split(",").map(t => t.trim()).filter(Boolean);
                setEditedParams({ ...editedParams, tags: tagsArray });
              }}
              placeholder="用逗号分隔，如: 角色小传, 主角"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">此操作暂无复杂参数可编辑，请直接确认。</p>
        {/* 可以遍历 formattedParams 并尝试提供通用编辑，但目前需求主要针对生成类 */}
      </div>
    );
  };

  return (
    <div className={cn(
      `rounded-lg backdrop-blur-sm border overflow-hidden ${bgColor} ${borderColor}`,
      isLoading && "opacity-70 pointer-events-none"
    )}>
      <div className="p-3 space-y-3">
        {/* Header with Icon and Title */}
        <div className="flex items-start gap-2.5">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full shrink-0 mt-0.5 ${iconBg}`}>
            <AlertCircle className={`h-4 w-4 ${iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {isSetArtStyle && artStyleName 
                ? `${functionCall.displayName || functionCall.name} - ${artStyleName}`
                : (functionCall.displayName || functionCall.name)
              }
            </p>
          </div>
        </div>

        {/* Function Call Details (Read Only Summary) */}
        <div className="space-y-2 pl-9">
          {isGenerateAssets ? (
            /* 生成素材：横向滚动预览 */
            generationAssets && generationAssets.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {generationAssets.map((asset, index) => (
                  <div key={index} className="flex-shrink-0 w-64 rounded-md bg-background/50 border border-border/50 p-3">
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
                          <span className="text-xs text-foreground break-words line-clamp-2">{asset.prompt}</span>
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
            )
          ) : isGenerateVideo ? (
            /* 生成视频：只读显示 */
            <div className="rounded-md bg-background/50 border border-border/50 p-3">
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
          ) : isCreateTextAsset ? (
            /* 创建文本资产：显示名称、内容预览、标签 */
            <div className="rounded-md bg-background/50 border border-border/50 p-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">名称:</span>
                  <span className="text-xs text-foreground">{editedParams.name as string || "未命名"}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">内容预览:</span>
                  {renderMarkdownPreview(editedParams.content as string || "")}
                </div>
                {editedParams.tags && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">标签:</span>
                    <span className="text-xs text-foreground">
                      {Array.isArray(editedParams.tags) 
                        ? editedParams.tags.join(", ") 
                        : editedParams.tags}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : isSetArtStyle ? (
            /* 设置美术风格：显示风格名称 */
            <div className="rounded-md bg-background/50 border border-border/50 p-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">美术风格:</span>
                {artStyleName ? (
                  <span className="text-xs text-foreground font-medium">{artStyleName}</span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">加载中...</span>
                  </div>
                )}
              </div>
            </div>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-background text-xs cursor-default">
                <Coins className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold text-foreground">{totalCost}</span>
                {insufficientBalance && (
                  <span className="flex items-center text-red-600 dark:text-red-400 ml-1">
                    <span className="text-xs">({currentBalance})</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPurchaseDialog(true);
                      }}
                      className="inline-flex items-center justify-center w-4 h-4 ml-0.5 rounded-sm text-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
                      title={t('credits.addCredits')}
                      type="button"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              {insufficientBalance 
                ? `${t('agent.credits.total')} ${totalCost} ${t('credits.creditsUnit')} (${t('agent.credits.insufficient')}: ${currentBalance})`
                : `${t('agent.credits.total')} ${totalCost} ${t('credits.creditsUnit')}`
              }
            </TooltipContent>
          </Tooltip>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => onCancel(functionCall.id)}
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={isLoading}
            >
              {isRejecting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <X className="h-3 w-3 mr-1" />
                  {t('editor.agent.pendingAction.reject')}
                </>
              )}
            </Button>
            
            {/* Edit Button */}
            {(isGenerateAssets || isGenerateVideo || isCreateTextAsset) && (
              <Button
                onClick={() => setShowEditDialog(true)}
                variant="outline"
                size="sm"
                className="h-7 px-3 text-xs"
                disabled={isLoading}
              >
                <Maximize2 className="h-3 w-3 mr-1" />
                详情 & 修改
              </Button>
            )}

            <Button
              onClick={() => {
                onConfirm(functionCall.id, editedParams);
              }}
              disabled={insufficientBalance || isLoading}
              size="sm"
              className="h-7 px-3 text-xs"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  执行中...
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  {t('editor.agent.pendingAction.confirm')}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isGenerateAssets 
                ? "编辑生成素材参数" 
                : isGenerateVideo 
                ? "编辑生成视频参数"
                : "编辑文本资产参数"}
            </DialogTitle>
            <DialogDescription>
              请在确认生成前检查并修改相关参数。
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {renderEditForm()}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button 
              onClick={() => {
                setShowEditDialog(false);
                // 这里我们不需要立即 confirm，而是关闭弹窗，用户可以点击卡片上的确认
                // 或者我们可以在这里直接 confirm？
                // 交互上：用户在弹窗改完，点击“确认修改”，应该只是保存到 editedParams？
                // 或者是“确认并执行”？
                // 方案：改为“确认并执行”更流畅。
                onConfirm(functionCall.id, editedParams);
              }}
              disabled={insufficientBalance || isLoading}
            >
              确认并执行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Dialog */}
      <PurchaseDialog
        open={showPurchaseDialog}
        onOpenChange={setShowPurchaseDialog}
      />
    </div>
  );
});
