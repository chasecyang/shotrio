"use client";

import { memo, useState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import {
  Check,
  X,
  Pencil,
  Loader2,
  Coins,
  AlertCircle,
  Send,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreditCost } from "@/lib/utils/credit-calculator";
import { PurchaseDialog } from "@/components/credits/purchase-dialog";
import { useAgent } from "./agent-context";
import { useAgentStream } from "./use-agent-stream";
import { useEditor } from "../editor-context";
import { toast } from "sonner";
import { estimateActionCredits } from "@/lib/actions/credits/estimate";
import { hasEnoughCredits } from "@/lib/actions/credits/balance";
import type { FunctionCall } from "@/types/agent";
import { getArtStyleById } from "@/lib/actions/art-style/queries";
import { AssetPreview } from "./action-editor-forms";
import { formatParametersForConfirmation } from "@/lib/utils/agent-params-formatter";

const AUTO_CONFIRM_DELAY_MS = 500;

interface ApprovalActionBarProps {
  approvalInfo: {
    toolCall: {
      id: string;
      type: "function";
      function: {
        name: string;
        arguments: string;
      };
    };
    funcDef: {
      name: string;
      displayName?: string;
      category: string;
      needsConfirmation: boolean;
    };
  };
  currentBalance?: number;
  isBottomMode?: boolean;
}

export const ApprovalActionBar = memo(function ApprovalActionBar({
  approvalInfo,
  currentBalance,
  isBottomMode = false,
}: ApprovalActionBarProps) {
  const t = useTranslations();
  const agent = useAgent();
  const editor = useEditor();

  const [isConfirming, setIsConfirming] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [artStyleName, setArtStyleName] = useState<string | null>(null);
  const autoBalanceCheckRef = useRef<{ toolCallId: string; inFlight: boolean } | null>(null);

  // 解析参数
  const parsedArgs = useMemo(() => {
    try {
      return JSON.parse(approvalInfo.toolCall.function.arguments);
    } catch {
      return {};
    }
  }, [approvalInfo.toolCall.function.arguments]);

  // 判断操作类型
  const functionName = approvalInfo.toolCall.function.name;
  const isGenerateAssets = functionName === "generate_image_asset";
  const isGenerateVideo = functionName === "generate_video_asset";
  const isCreateTextAsset = functionName === "create_text_asset";
  const isSetProjectInfo = functionName === "set_project_info";

  // 解析生成素材的assets数组
  const generationAssets = useMemo(() => {
    if (!isGenerateAssets) return null;

    try {
      const assetsArg = parsedArgs.assets;
      let assetsArray: Array<Record<string, unknown>>;

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
            // ignore
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
  }, [isGenerateAssets, parsedArgs.assets]);

  // 解析视频生成参数
  const videoGenerationParams = useMemo(() => {
    if (!isGenerateVideo) return null;

    return {
      prompt: (parsedArgs.prompt as string) || "",
      startImageUrl: (parsedArgs.start_image_url as string) || "",
      endImageUrl: (parsedArgs.end_image_url as string) || undefined,
      duration: (parsedArgs.duration as string) || "4",
      aspectRatio: (parsedArgs.aspect_ratio as string) || "16:9",
      title: (parsedArgs.title as string) || undefined,
    };
  }, [isGenerateVideo, parsedArgs]);

  // 格式化其他参数
  const formattedParams = useMemo(() => {
    if (isGenerateAssets || isGenerateVideo || isSetProjectInfo || isCreateTextAsset) {
      return [];
    }
    return formatParametersForConfirmation(parsedArgs);
  }, [parsedArgs, isGenerateAssets, isGenerateVideo, isSetProjectInfo, isCreateTextAsset]);

  // 获取美术风格名称
  useEffect(() => {
    if (!isSetProjectInfo) return;

    const styleId = parsedArgs.styleId as string;
    if (!styleId) return;

    getArtStyleById(styleId).then((style) => {
      if (style) {
        setArtStyleName(style.name);
      }
    }).catch((error) => {
      console.error("获取美术风格名称失败:", error);
    });
  }, [isSetProjectInfo, parsedArgs.styleId]);

  // 异步获取积分估算
  const [creditCost, setCreditCost] = useState<CreditCost | undefined>();
  const [isEstimatingCredits, setIsEstimatingCredits] = useState(false);

  useEffect(() => {
    if (!approvalInfo) {
      setCreditCost(undefined);
      setIsEstimatingCredits(false);
      return;
    }

    setCreditCost(undefined);
    let isActive = true;
    const estimate = async () => {
      try {
        setIsEstimatingCredits(true);
        const functionCall: FunctionCall = {
          id: approvalInfo.toolCall.id,
          name: approvalInfo.toolCall.function.name,
          displayName: approvalInfo.funcDef.displayName,
          parameters: parsedArgs,
          category: approvalInfo.funcDef.category as FunctionCall["category"],
          needsConfirmation: true,
        };

        const result = await estimateActionCredits([functionCall]);
        if (isActive && result.success && result.creditCost) {
          setCreditCost(result.creditCost);
        }
      } catch (error) {
        console.error("估算积分失败:", error);
      } finally {
        if (isActive) {
          setIsEstimatingCredits(false);
        }
      }
    };

    estimate();
    return () => {
      isActive = false;
    };
  }, [approvalInfo, parsedArgs]);

  const totalCost = creditCost?.total || 0;
  const insufficientBalance =
    currentBalance !== undefined && totalCost > currentBalance;

  // 判断是否支持编辑参数
  const canEdit = useMemo(() => {
    const name = approvalInfo.toolCall.function.name;
    return ["generate_image_asset", "generate_video_asset", "create_text_asset"].includes(name);
  }, [approvalInfo.toolCall.function.name]);

  // 使用 Agent Stream Hook
  const { resumeConversation } = useAgentStream();

  const addRejectionToolMessage = (toolCallId: string) => {
    agent.addMessage({
      id: `tool-${toolCallId}-${Date.now()}`,
      role: "tool",
      content: JSON.stringify({
        success: false,
        error: "用户拒绝了此操作",
        userRejected: true,
      }),
      toolCallId,
    });
  };

  // 自动执行模式
  useEffect(() => {
    let isActive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const attemptAutoConfirm = async () => {
      if (
        !approvalInfo ||
        !agent.state.isAutoAcceptEnabled ||
        isConfirming ||
        isRejecting ||
        isEstimatingCredits ||
        !creditCost
      ) {
        return;
      }

      if (totalCost > 0) {
        if (currentBalance !== undefined) {
          if (totalCost > currentBalance) {
            toast.warning("积分不足，无法自动执行");
            agent.setAutoAccept(false);
            return;
          }
        } else {
          const toolCallId = approvalInfo.toolCall.id;
          if (autoBalanceCheckRef.current?.toolCallId === toolCallId && autoBalanceCheckRef.current?.inFlight) {
            return;
          }

          autoBalanceCheckRef.current = { toolCallId, inFlight: true };
          const creditCheck = await hasEnoughCredits(totalCost);
          autoBalanceCheckRef.current = { toolCallId, inFlight: false };

          if (!creditCheck.success || !creditCheck.hasEnough) {
            toast.warning("积分不足，无法自动执行");
            agent.setAutoAccept(false);
            return;
          }
        }
      }

      if (!isActive) return;
      timer = setTimeout(() => {
        console.log("[AutoAccept] 自动确认操作:", approvalInfo.toolCall.id);
        handleConfirm();
      }, AUTO_CONFIRM_DELAY_MS);
    };

    attemptAutoConfirm();

    return () => {
      isActive = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [
    approvalInfo,
    agent.state.isAutoAcceptEnabled,
    isConfirming,
    isRejecting,
    isEstimatingCredits,
    creditCost,
    totalCost,
    currentBalance,
  ]);

  // 确认操作
  const handleConfirm = async () => {
    if (!agent.state.currentConversationId || isConfirming) return;

    if (isEstimatingCredits || !creditCost) {
      toast.info("正在计算积分，请稍候...");
      return;
    }

    if (totalCost > 0 && currentBalance === undefined) {
      const creditCheck = await hasEnoughCredits(totalCost);
      if (!creditCheck.success || !creditCheck.hasEnough) {
        setShowPurchaseDialog(true);
        return;
      }
    }

    if (insufficientBalance) {
      setShowPurchaseDialog(true);
      return;
    }

    setIsConfirming(true);

    try {
      toast.success("操作已确认，Agent 正在继续...");
      agent.setLoading(true);
      editor.clearActionEditor();
      await resumeConversation(agent.state.currentConversationId, true);
      setFeedbackText("");
    } catch (error) {
      console.error("确认操作失败:", error);
      toast.error("确认操作失败");
      agent.setLoading(false);
    } finally {
      setIsConfirming(false);
    }
  };

  // 确认并开启自动模式
  const handleConfirmAndAutoAccept = async () => {
    agent.setAutoAccept(true);
    await handleConfirm();
  };

  // 拒绝操作
  const handleReject = async () => {
    if (!agent.state.currentConversationId || isRejecting) return;

    setIsRejecting(true);

    try {
      const toolCallId = approvalInfo.toolCall.id;

      // 立即创建拒绝的 tool message（用于 UI 及时展示）
      addRejectionToolMessage(toolCallId);

      toast.info("操作已拒绝");
      editor.clearActionEditor();
      await resumeConversation(agent.state.currentConversationId, false);
    } catch (error) {
      console.error("拒绝操作失败:", error);
      toast.error("拒绝操作失败");
    } finally {
      setFeedbackText("");
      setIsRejecting(false);
    }
  };

  // 带反馈的拒绝
  const handleRejectWithFeedback = async () => {
    if (!agent.state.currentConversationId || isRejecting || !feedbackText.trim()) return;

    setIsRejecting(true);

    try {
      const toolCallId = approvalInfo.toolCall.id;
      const trimmedFeedback = feedbackText.trim();

      // 创建拒绝的 tool message（反馈会作为普通 user message 单独追加）
      addRejectionToolMessage(toolCallId);

      // 将用户反馈作为一条普通 user message 展示在对话中
      agent.addMessage({
        id: `msg-feedback-${Date.now()}`,
        role: "user",
        content: trimmedFeedback,
      });

      toast.info("已发送反馈，Agent 正在回应...");
      agent.setLoading(true);
      editor.clearActionEditor();
      await resumeConversation(
        agent.state.currentConversationId,
        false,
        undefined,
        trimmedFeedback
      );

      // 清空反馈
      setFeedbackText("");
    } catch (error) {
      console.error("发送反馈失败:", error);
      toast.error("发送反馈失败");
      agent.setLoading(false);
    } finally {
      setIsRejecting(false);
    }
  };

  // 编辑参数
  const handleEdit = () => {
    editor.setActionEditor({
      functionCall: {
        id: approvalInfo.toolCall.id,
        name: approvalInfo.toolCall.function.name,
        displayName: approvalInfo.funcDef.displayName,
        arguments: parsedArgs,
        category: approvalInfo.funcDef.category,
      },
      creditCost,
      currentBalance,
      onConfirm: async (_id: string, modifiedParams?: Record<string, unknown>) => {
        if (!agent.state.currentConversationId) return;

        setIsConfirming(true);
        try {
          toast.success("操作已确认，Agent 正在继续...");
          agent.setLoading(true);
          await resumeConversation(agent.state.currentConversationId, true, modifiedParams);
          setFeedbackText("");
        } catch (error) {
          console.error("确认操作失败:", error);
          toast.error("确认操作失败");
          agent.setLoading(false);
        } finally {
          setIsConfirming(false);
        }
      },
      onCancel: async () => {
        await handleReject();
      },
    });
  };

  // 判断是否有参数需要展示
  const hasParamsToShow = isGenerateAssets
    ? generationAssets && generationAssets.length > 0
    : isGenerateVideo
    ? videoGenerationParams
    : isCreateTextAsset
    ? parsedArgs.content
    : isSetProjectInfo
    ? parsedArgs.title || parsedArgs.description || parsedArgs.styleId
    : formattedParams.length > 0;

  // 键盘快捷键
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (feedbackText.trim()) {
        handleRejectWithFeedback();
      }
    }
  };

  const isLoading = isConfirming || isRejecting;

  // 获取操作显示名称
  const getDisplayName = () => {
    const name = approvalInfo.toolCall.function.name;
    switch (name) {
      case "generate_image_asset":
        return "生成图片素材";
      case "generate_video_asset":
        return "生成视频素材";
      case "create_text_asset":
        return "创建文本资产";
      case "set_project_info":
        return "设置项目信息";
      default:
        return approvalInfo.funcDef.displayName || name;
    }
  };

  return (
    <div className={cn(
      "border-t border-border/80 shrink-0 bg-background/95 dark:bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 dark:supports-[backdrop-filter]:bg-surface/70",
      isBottomMode ? "p-2" : "p-4"
    )}>
      <div className={cn(
        "rounded-xl border border-border bg-muted/30 overflow-hidden transition-all",
        isLoading && "opacity-70 pointer-events-none"
      )}>
        {/* 可编辑区域容器 - 使用 group 实现联动 hover */}
        <div
          className={cn(canEdit && "group cursor-pointer")}
          onClick={canEdit ? handleEdit : undefined}
        >
          {/* Header */}
          <div
            className={cn(
              "flex items-center justify-between px-4 py-3 border-b border-border/50 transition-colors",
              canEdit && "group-hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                <AlertCircle className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-medium">{getDisplayName()}</span>
              {canEdit && (
                <Pencil className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            {totalCost > 0 && (
              <div className={cn(
                "flex items-center gap-1 text-sm",
                insufficientBalance ? "text-red-500" : "text-muted-foreground"
              )}>
                <Coins className="h-3.5 w-3.5" />
                <span>{totalCost}</span>
              </div>
            )}
          </div>

          {/* Parameters Preview */}
          {hasParamsToShow && (
            <div
              className={cn(
                "relative border-b border-border/50 overflow-y-auto transition-colors",
                canEdit && "group-hover:bg-muted/50",
                isBottomMode ? "max-h-[100px] py-2 px-3" : "max-h-[200px] px-4 py-3"
              )}
            >
            {isGenerateAssets && generationAssets && generationAssets.length > 0 ? (
              /* 生成图片：横向滚动预览 */
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {generationAssets.map((asset, index) => (
                  <div key={index} className="flex-shrink-0 w-56 rounded-md bg-background/50 border border-border/50 p-2.5">
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
                        <div className="space-y-1">
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
            ) : isGenerateVideo && videoGenerationParams ? (
              /* 生成视频：显示核心参数 */
              <div className="space-y-2">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">提示词:</span>
                  <p className="text-xs text-foreground break-words line-clamp-2">{videoGenerationParams.prompt}</p>
                </div>
                {videoGenerationParams.title && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">标题:</span>
                    <span className="text-xs text-foreground">{videoGenerationParams.title}</span>
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">时长:</span>
                    <span className="text-xs text-foreground">{videoGenerationParams.duration}秒</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">宽高比:</span>
                    <span className="text-xs text-foreground">{videoGenerationParams.aspectRatio}</span>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">起始帧</span>
                    </div>
                    <AssetPreview assetIds={[videoGenerationParams.startImageUrl]} />
                  </div>
                  {videoGenerationParams.endImageUrl && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">结束帧</span>
                      </div>
                      <AssetPreview assetIds={[videoGenerationParams.endImageUrl]} />
                    </div>
                  )}
                </div>
              </div>
            ) : isCreateTextAsset ? (
              /* 创建文本资产 */
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">名称:</span>
                  <span className="text-xs text-foreground">{parsedArgs.name as string || "未命名"}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">内容预览:</span>
                  <div className="max-h-24 overflow-y-auto border rounded-md p-2 bg-muted/20 text-xs text-foreground/80">
                    <MarkdownRenderer content={parsedArgs.content as string || "*暂无内容*"} />
                  </div>
                </div>
                {parsedArgs.tags && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">标签:</span>
                    <span className="text-xs text-foreground">
                      {Array.isArray(parsedArgs.tags)
                        ? parsedArgs.tags.join(", ")
                        : String(parsedArgs.tags)}
                    </span>
                  </div>
                )}
              </div>
            ) : isSetProjectInfo ? (
              /* 设置项目信息 */
              <div className="space-y-1.5">
                {parsedArgs.title && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">标题:</span>
                    <span className="text-xs text-foreground">{parsedArgs.title}</span>
                  </div>
                )}
                {parsedArgs.description && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-muted-foreground shrink-0">描述:</span>
                    <span className="text-xs text-foreground break-words">{parsedArgs.description}</span>
                  </div>
                )}
                {parsedArgs.styleId && (
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
                )}
              </div>
            ) : formattedParams.length > 0 ? (
              /* 其他操作：使用格式化参数展示 */
              <div className="space-y-1.5">
                {formattedParams.map((param) => (
                  <div key={param.key} className="space-y-1">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground shrink-0">{param.label}:</span>
                      <span className="text-xs text-foreground break-words">{param.value}</span>
                    </div>
                    {param.isAssetReference && param.assetIds && param.assetIds.length > 0 && (
                      <div className="pl-0 pt-1">
                        <AssetPreview assetIds={param.assetIds} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
        </div>

        {/* Actions */}
        <div className={cn(isBottomMode ? "px-2 py-2" : "p-3 space-y-2")}>
          {isBottomMode ? (
            /* 底部模式：水平紧凑布局 */
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleConfirm}
                    disabled={isLoading || isEstimatingCredits}
                    size="sm"
                    className="shrink-0"
                  >
                    {isConfirming ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("editor.agent.pendingAction.confirm")}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleConfirmAndAutoAccept}
                    disabled={isLoading || isEstimatingCredits}
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <Check className="h-3.5 w-3.5 -ml-2" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("editor.agent.pendingAction.confirmAllDescription")}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleReject}
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    className="shrink-0"
                  >
                    {isRejecting && !feedbackText.trim() ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("editor.agent.pendingAction.reject")}</p>
                </TooltipContent>
              </Tooltip>

              <div className="w-px h-6 bg-border mx-1" />

              <Textarea
                ref={textareaRef}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("editor.agent.pendingAction.feedbackPlaceholder")}
                className="flex-1 min-h-[32px] max-h-[32px] resize-none text-sm py-1.5"
                disabled={isLoading}
                rows={1}
              />

              <Button
                size="sm"
                onClick={handleRejectWithFeedback}
                disabled={isLoading || !feedbackText.trim()}
                className="shrink-0"
              >
                {isRejecting && feedbackText.trim() ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ) : (
            /* 默认模式：两行垂直布局 */
            <>
              {/* 第一行：确认、拒绝、修改 */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleConfirm}
                  disabled={isLoading || isEstimatingCredits}
                  size="sm"
                  className="flex-1"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      执行中...
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      {t("editor.agent.pendingAction.confirm")}
                    </>
                  )}
                </Button>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleConfirmAndAutoAccept}
                      disabled={isLoading || isEstimatingCredits}
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                    >
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      {t("editor.agent.pendingAction.confirmAll")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("editor.agent.pendingAction.confirmAllDescription")}</p>
                  </TooltipContent>
                </Tooltip>

                <Button
                  onClick={handleReject}
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isRejecting && !feedbackText.trim() ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      处理中...
                    </>
                  ) : (
                    <>
                      <X className="h-3.5 w-3.5 mr-1.5" />
                      {t("editor.agent.pendingAction.reject")}
                    </>
                  )}
                </Button>
              </div>

              {/* 第二行：反馈输入框 + 发送按钮 */}
              <div className="flex items-center gap-2">
                <Textarea
                  ref={textareaRef}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("editor.agent.pendingAction.feedbackPlaceholder")}
                  className="flex-1 min-h-[36px] max-h-[80px] resize-none text-sm py-2"
                  disabled={isLoading}
                  rows={1}
                />
                <Button
                  size="sm"
                  onClick={handleRejectWithFeedback}
                  disabled={isLoading || !feedbackText.trim()}
                  className="shrink-0"
                >
                  {isRejecting && feedbackText.trim() ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </>
          )}
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
