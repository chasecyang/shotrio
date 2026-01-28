"use client";

import { memo, useState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
import { AssetReferenceInput, type AssetReferenceInputHandle } from "./asset-reference-input";
import { useAssetMention } from "./use-asset-mention";
import { AssetMentionDropdown } from "./asset-mention-dropdown";
import { useAssetReferenceCallback } from "./use-asset-reference-callback";

const AUTO_CONFIRM_DELAY_MS = 500;

interface ToolCallWithDef {
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
}

interface ApprovalActionBarProps {
  approvalInfo: ToolCallWithDef | {
    toolCalls: ToolCallWithDef[];
    funcDef: ToolCallWithDef["funcDef"];
  };
  currentBalance?: number;
  isBottomMode?: boolean;
}

// 类型守卫：判断是否为批量模式
function isBatchApproval(info: ApprovalActionBarProps["approvalInfo"]): info is { toolCalls: ToolCallWithDef[]; funcDef: ToolCallWithDef["funcDef"] } {
  return "toolCalls" in info && Array.isArray(info.toolCalls);
}

export const ApprovalActionBar = memo(function ApprovalActionBar({
  approvalInfo,
  currentBalance,
  isBottomMode = false,
}: ApprovalActionBarProps) {
  const t = useTranslations();
  const tAgent = useTranslations("editor.agent");
  const agent = useAgent();
  const editor = useEditor();

  const [isConfirming, setIsConfirming] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const inputRef = useRef<AssetReferenceInputHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [artStyleName, setArtStyleName] = useState<string | null>(null);
  const autoBalanceCheckRef = useRef<{ toolCallId: string; inFlight: boolean } | null>(null);

  // 判断是否为批量模式
  const isBatch = isBatchApproval(approvalInfo);

  // 统一获取 toolCall 和 funcDef（批量模式使用第一个）
  const primaryToolCall = isBatch ? approvalInfo.toolCalls[0].toolCall : approvalInfo.toolCall;
  const primaryFuncDef = isBatch ? approvalInfo.toolCalls[0].funcDef : approvalInfo.funcDef;

  // 批量模式下的所有 tool calls
  const allToolCalls = isBatch
    ? approvalInfo.toolCalls.map(item => item.toolCall)
    : [primaryToolCall];

  // Asset mention functionality
  const {
    mentionState,
    filteredAssets,
    selectedIndex,
    handleInputChange,
    handleKeyDown: handleMentionKeyDown,
    insertAssetReference,
  } = useAssetMention({
    textareaRef: containerRef,
    value: feedbackText,
    onChange: setFeedbackText,
    assets: editor.state.assets,
    isContentEditable: true,
    dropdownRef,
  });

  // Register asset reference callback
  const handleAssetReference = useAssetReferenceCallback({
    value: feedbackText,
    onChange: setFeedbackText,
    focusRef: inputRef,
  });

  useEffect(() => {
    if (editor.registerReferenceCallback) {
      editor.registerReferenceCallback(handleAssetReference);
    }

    // Cleanup: unregister callback when component unmounts
    return () => {
      editor.unregisterReferenceCallback?.();
    };
  }, [editor, handleAssetReference]);

  // 解析参数（批量模式下解析第一个的参数用于类型判断）
  const parsedArgs = useMemo(() => {
    try {
      return JSON.parse(primaryToolCall.function.arguments);
    } catch {
      return {};
    }
  }, [primaryToolCall.function.arguments]);

  // 批量模式下解析所有参数
  const allParsedArgs = useMemo(() => {
    return allToolCalls.map(tc => {
      try {
        return JSON.parse(tc.function.arguments);
      } catch {
        return {};
      }
    });
  }, [allToolCalls]);

  // 判断操作类型
  const functionName = primaryToolCall.function.name;
  const isGenerateAssets = functionName === "generate_image_asset";
  const isGenerateVideo = functionName === "generate_video_asset";
  const isCreateTextAsset = functionName === "create_text_asset";
  const isSetProjectInfo = functionName === "set_project_info";
  const stylePrompt = typeof parsedArgs.stylePrompt === "string" ? parsedArgs.stylePrompt : "";
  const hasStylePrompt = stylePrompt.trim().length > 0;
  const styleId = typeof parsedArgs.styleId === "string" ? parsedArgs.styleId : "";

  // 检测是否为混合类型批量操作
  const isMixedTypeBatch = useMemo(() => {
    if (!isBatch) return false;
    const types = new Set(allToolCalls.map(tc => tc.function.name));
    return types.size > 1;
  }, [isBatch, allToolCalls]);

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
        const name = asset.name || tAgent("actionBar.placeholders.unnamed");
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
          aspectRatio:
            typeof asset.aspect_ratio === "string" ? asset.aspect_ratio : "16:9",
        };
      });
    } catch (error) {
      console.error(tAgent("actionBar.errors.parseAssetsFailed"), error);
      return null;
    }
  }, [isGenerateAssets, parsedArgs.assets]);

  // Veo 3.1 固定时长
  const VEO_FIXED_DURATION = 8;

  // 解析视频生成参数 - Veo 3.1 reference_image_ids 模式
  const videoGenerationParams = useMemo(() => {
    if (!isGenerateVideo) return null;

    const parseVideoArgs = (args: Record<string, unknown>) => {
      // Veo 3.1 模式：reference_image_ids
      const referenceImageIds = Array.isArray(args.reference_image_ids)
        ? (args.reference_image_ids as string[])
        : [];

      return {
        prompt: (args.prompt as string) || "",
        referenceImageIds,
        aspectRatio: (args.aspect_ratio as string) || "16:9",
        title: (args.title as string) || undefined,
      };
    };

    // 批量模式：解析所有视频参数
    if (isBatch && allParsedArgs.length > 1) {
      return allParsedArgs.map(parseVideoArgs);
    }

    // 单个模式
    return [parseVideoArgs(parsedArgs)];
  }, [isGenerateVideo, parsedArgs, isBatch, allParsedArgs]);

  // 格式化其他参数
  const formattedParams = useMemo(() => {
    if (isGenerateAssets || isGenerateVideo || isSetProjectInfo || isCreateTextAsset) {
      return [];
    }
    // 使用翻译函数
    const tKeys = (key: string) => tAgent(`params.keys.${key}`) || key;
    const tValues = (key: string, params?: Record<string, string | number>) => {
      if (params) {
        return tAgent(`params.values.${key}`, params);
      }
      return tAgent(`params.values.${key}`);
    };
    return formatParametersForConfirmation(parsedArgs, tKeys, tValues);
  }, [parsedArgs, isGenerateAssets, isGenerateVideo, isSetProjectInfo, isCreateTextAsset, tAgent]);

  // 获取美术风格名称
  useEffect(() => {
    if (!isSetProjectInfo) {
      setArtStyleName(null);
      return;
    }

    if (hasStylePrompt || !styleId) {
      setArtStyleName(null);
      return;
    }

    let isActive = true;
    getArtStyleById(styleId).then((style) => {
      if (isActive) {
        setArtStyleName(style ? style.name : null);
      }
    }).catch((error) => {
      if (isActive) {
        console.error(tAgent("actionBar.errors.fetchStyleFailed"), error);
      }
    });

    return () => {
      isActive = false;
    };
  }, [hasStylePrompt, isSetProjectInfo, styleId]);

  // 异步获取积分估算（支持批量）
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

        // 构建所有 function calls 用于积分估算
        const functionCalls: FunctionCall[] = isBatch
          ? approvalInfo.toolCalls.map((item, index) => ({
              id: item.toolCall.id,
              name: item.toolCall.function.name,
              displayName: item.funcDef.displayName,
              parameters: allParsedArgs[index],
              category: item.funcDef.category as FunctionCall["category"],
              needsConfirmation: true,
            }))
          : [{
              id: primaryToolCall.id,
              name: primaryToolCall.function.name,
              displayName: primaryFuncDef.displayName,
              parameters: parsedArgs,
              category: primaryFuncDef.category as FunctionCall["category"],
              needsConfirmation: true,
            }];

        const result = await estimateActionCredits(functionCalls);
        if (isActive && result.success && result.creditCost) {
          setCreditCost(result.creditCost);
        }
      } catch (error) {
        console.error(tAgent("actionBar.errors.estimateFailed"), error);
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

  // 判断是否支持编辑参数（批量模式支持视频和图片生成）
  const canEdit = useMemo(() => {
    const name = primaryToolCall.function.name;
    const supportedFunctions = ["generate_image_asset", "generate_video_asset", "create_text_asset"];
    if (!supportedFunctions.includes(name)) return false;

    // 批量模式支持视频和图片生成编辑
    if (isBatch) {
      return name === "generate_video_asset" || name === "generate_image_asset";
    }
    return true;
  }, [isBatch, primaryToolCall.function.name]);

  // 使用 Agent Stream Hook
  const { resumeConversation } = useAgentStream();

  // 为单个 tool call 添加拒绝消息
  const addRejectionToolMessage = (toolCallId: string) => {
    agent.addMessage({
      id: `tool-${toolCallId}-${Date.now()}`,
      role: "tool",
      content: JSON.stringify({
        success: false,
        error: tAgent("toolExecution.status.rejected"),
        userRejected: true,
      }),
      toolCallId,
    });
  };

  // 为所有 tool calls 添加拒绝消息（批量模式）
  const addAllRejectionToolMessages = () => {
    for (const tc of allToolCalls) {
      addRejectionToolMessage(tc.id);
    }
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
            toast.warning(tAgent("actionBar.toasts.insufficientCreditsAuto"));
            agent.setAutoAccept(false);
            return;
          }
        } else {
          const toolCallId = primaryToolCall.id;
          if (autoBalanceCheckRef.current?.toolCallId === toolCallId && autoBalanceCheckRef.current?.inFlight) {
            return;
          }

          autoBalanceCheckRef.current = { toolCallId, inFlight: true };
          const creditCheck = await hasEnoughCredits(totalCost);
          autoBalanceCheckRef.current = { toolCallId, inFlight: false };

          if (!creditCheck.success || !creditCheck.hasEnough) {
            toast.warning(tAgent("actionBar.toasts.insufficientCreditsAuto"));
            agent.setAutoAccept(false);
            return;
          }
        }
      }

      if (!isActive) return;
      timer = setTimeout(() => {
        console.log("[AutoAccept] 自动确认操作:", isBatch ? `批量 ${allToolCalls.length} 个` : primaryToolCall.id);
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
      toast.info(tAgent("actionBar.messages.calculating"));
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
      toast.success(tAgent("actionBar.toasts.operationConfirmed"));
      agent.setLoading(true);
      editor.clearActionEditor();
      await resumeConversation(agent.state.currentConversationId, true);
      setFeedbackText("");
    } catch (error) {
      console.error("确认操作失败:", error);
      toast.error(tAgent("actionBar.toasts.confirmFailed"));
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

  // 拒绝操作（支持批量）
  const handleReject = async () => {
    if (!agent.state.currentConversationId || isRejecting) return;

    setIsRejecting(true);

    try {
      // 立即创建拒绝的 tool message（用于 UI 及时展示）
      addAllRejectionToolMessages();

      toast.info(tAgent("actionBar.toasts.operationRejected"));
      editor.clearActionEditor();
      await resumeConversation(agent.state.currentConversationId, false);
    } catch (error) {
      console.error("拒绝操作失败:", error);
      toast.error(tAgent("actionBar.toasts.rejectFailed"));
    } finally {
      setFeedbackText("");
      setIsRejecting(false);
    }
  };

  // 带反馈的拒绝（支持批量）
  const handleRejectWithFeedback = async () => {
    if (!agent.state.currentConversationId || isRejecting || !feedbackText.trim()) return;

    setIsRejecting(true);

    try {
      const trimmedFeedback = feedbackText.trim();

      // 创建拒绝的 tool message（反馈会作为普通 user message 单独追加）
      addAllRejectionToolMessages();

      // 将用户反馈作为一条普通 user message 展示在对话中
      agent.addMessage({
        id: `msg-feedback-${Date.now()}`,
        role: "user",
        content: trimmedFeedback,
      });

      toast.info(tAgent("actionBar.toasts.feedbackSent"));
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
      toast.error(tAgent("actionBar.toasts.feedbackFailed"));
      agent.setLoading(false);
    } finally {
      setIsRejecting(false);
    }
  };

  // 编辑参数（支持批量模式）
  const handleEdit = () => {
    // 构建所有 function calls 数据
    const functionCalls = isBatch
      ? approvalInfo.toolCalls.map((item, index) => ({
          id: item.toolCall.id,
          name: item.toolCall.function.name,
          displayName: item.funcDef.displayName,
          arguments: allParsedArgs[index],
          category: item.funcDef.category,
        }))
      : undefined;

    editor.setActionEditor({
      functionCall: {
        id: primaryToolCall.id,
        name: primaryToolCall.function.name,
        displayName: primaryFuncDef.displayName,
        arguments: parsedArgs,
        category: primaryFuncDef.category,
      },
      functionCalls,
      creditCost,
      currentBalance,
      onConfirm: async (_id: string, modifiedParams?: Record<string, unknown>) => {
        if (!agent.state.currentConversationId) return;

        setIsConfirming(true);
        try {
          toast.success(tAgent("actionBar.toasts.operationConfirmed"));
          agent.setLoading(true);
          await resumeConversation(agent.state.currentConversationId, true, modifiedParams);
          setFeedbackText("");
        } catch (error) {
          console.error("确认操作失败:", error);
          toast.error(tAgent("actionBar.toasts.confirmFailed"));
          agent.setLoading(false);
        } finally {
          setIsConfirming(false);
        }
      },
      onCancel: async () => {
        await handleReject();
      },
      onBatchConfirm: isBatch ? async (modifiedParamsMap: Map<string, Record<string, unknown>>, disabledIds?: Set<string>) => {
        if (!agent.state.currentConversationId) return;

        setIsConfirming(true);
        try {
          toast.success(tAgent("actionBar.toasts.operationConfirmed"));
          agent.setLoading(true);
          // 批量模式：传递所有修改后的参数和禁用的 IDs
          await resumeConversation(
            agent.state.currentConversationId,
            true,
            undefined,
            undefined,
            modifiedParamsMap,
            disabledIds
          );
          setFeedbackText("");
        } catch (error) {
          console.error("批量确认操作失败:", error);
          toast.error(tAgent("actionBar.toasts.confirmFailed"));
          agent.setLoading(false);
        } finally {
          setIsConfirming(false);
        }
      } : undefined,
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
    ? parsedArgs.title || parsedArgs.description || parsedArgs.stylePrompt || parsedArgs.styleId
    : formattedParams.length > 0;

  // 键盘快捷键
  const combinedKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 类型兼容：HTMLDivElement 可以安全地传递给期望 HTMLTextAreaElement | HTMLDivElement 的函数
    handleMentionKeyDown(e as React.KeyboardEvent<HTMLTextAreaElement | HTMLDivElement>);
    if (!mentionState.isOpen) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (feedbackText.trim()) {
          handleRejectWithFeedback();
        }
      }
    }
  };

  const isLoading = isConfirming || isRejecting;

  // 获取操作显示名称
  const getDisplayName = () => {
    const name = primaryToolCall.function.name;
    // 将 snake_case 转换为 camelCase 用于翻译键
    const keyMap: Record<string, string> = {
      query_context: "queryContext",
      query_assets: "queryAssets",
      query_text_assets: "queryTextAssets",
      query_timeline: "queryTimeline",
      generate_image_asset: "generateImageAsset",
      generate_video_asset: "generateVideoAsset",
      create_text_asset: "createTextAsset",
      set_project_info: "setProjectInfo",
      update_asset: "updateAsset",
      delete_asset: "deleteAsset",
      add_clip: "addClip",
      remove_clip: "removeClip",
      update_clip: "updateClip",
      add_audio_track: "addAudioTrack",
      generate_sound_effect: "generateSoundEffect",
      generate_bgm: "generateBgm",
      generate_dialogue: "generateDialogue",
    };
    const key = keyMap[name];
    let baseName = key ? tAgent(`toolExecution.displayNames.${key}`) : (primaryFuncDef.displayName || name);

    // 批量模式显示数量
    if (isBatch) {
      baseName = `${baseName} (${allToolCalls.length})`;
    }

    return baseName;
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
            {isMixedTypeBatch ? (
              /* 混合类型批量操作：统一列表预览 */
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {allToolCalls.map((tc, index) => {
                  const args = allParsedArgs[index];
                  const tcName = tc.function.name;
                  const typeLabel = tcName === "generate_video_asset"
                    ? tAgent("actionBar.types.video")
                    : tcName === "generate_image_asset"
                      ? tAgent("actionBar.types.image")
                      : tcName === "create_text_asset"
                        ? tAgent("actionBar.types.text")
                        : tcName;

                  return (
                    <div key={tc.id} className="flex-shrink-0 w-56 rounded-md bg-background/50 border border-border/50 p-2.5">
                      <div className="space-y-1.5">
                        {/* 类型标签 */}
                        <div className="flex items-center gap-2">
                          <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-medium">
                            {typeLabel}
                          </span>
                          {(args.title || args.name) && (
                            <span className="text-xs text-foreground truncate">{args.title || args.name}</span>
                          )}
                        </div>
                        {/* Prompt */}
                        {args.prompt && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-medium text-muted-foreground shrink-0">{tAgent("actionBar.labels.prompt")}:</span>
                            <span className="text-xs text-foreground break-words line-clamp-2">{args.prompt}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : isGenerateAssets && generationAssets && generationAssets.length > 0 ? (
              /* 生成图片：横向滚动预览 */
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {generationAssets.map((asset, index) => (
                  <div key={index} className="flex-shrink-0 w-56 rounded-md bg-background/50 border border-border/50 p-2.5">
                    <div className="space-y-1.5">
                      {asset.name && asset.name !== "-" && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">{tAgent("actionBar.labels.name")}:</span>
                          <span className="text-xs text-foreground truncate">{asset.name}</span>
                        </div>
                      )}
                      {asset.prompt && asset.prompt !== "-" && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-medium text-muted-foreground shrink-0">{tAgent("actionBar.labels.prompt")}:</span>
                          <span className="text-xs text-foreground break-words line-clamp-2">{asset.prompt}</span>
                        </div>
                      )}
                      {asset.tags && asset.tags !== "-" && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">{tAgent("actionBar.labels.tags")}:</span>
                          <span className="text-xs text-foreground truncate">{asset.tags}</span>
                        </div>
                      )}
                      {asset.aspectRatio && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">{tAgent("actionBar.labels.aspectRatio")}:</span>
                          <span className="text-xs text-foreground">{asset.aspectRatio}</span>
                        </div>
                      )}
                      {asset.sourceAssetIds && asset.sourceAssetIds.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground">{tAgent("actionBar.labels.referenceImages")}:</span>
                            <span className="text-xs text-foreground">{tAgent("actionBar.units.imagesCount", { count: asset.sourceAssetIds.length })}</span>
                          </div>
                          <AssetPreview assetIds={asset.sourceAssetIds} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : isGenerateVideo && videoGenerationParams && videoGenerationParams.length > 0 ? (
              /* 生成视频：显示核心参数（支持批量，Veo 3.1 模式） */
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {videoGenerationParams.map((params, index) => (
                  <div key={index} className="flex-shrink-0 w-64 rounded-md bg-background/50 border border-border/50 p-2.5 space-y-1.5">
                    {params.title && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground truncate">{params.title}</span>
                      </div>
                    )}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">{tAgent("actionBar.labels.prompt")}:</span>
                      <p className="text-xs text-foreground break-words line-clamp-2">{params.prompt}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{tAgent("actionBar.labels.aspectRatio")}:</span>
                      <span className="text-xs text-foreground">{params.aspectRatio}</span>
                    </div>
                    {/* 显示参考图片 */}
                    {params.referenceImageIds && params.referenceImageIds.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <ImageIcon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            {tAgent("actionBar.labels.referenceImages")} ({params.referenceImageIds.length})
                          </span>
                        </div>
                        <AssetPreview assetIds={params.referenceImageIds} />
                      </div>
                    )}
                    {/* Veo 3.1 固定时长 */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{tAgent("actionBar.labels.duration")}:</span>
                      <span className="text-xs text-foreground">{VEO_FIXED_DURATION}s</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : isCreateTextAsset ? (
              /* 创建文本资产 */
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{tAgent("actionBar.labels.name")}:</span>
                  <span className="text-xs text-foreground">{parsedArgs.name as string || tAgent("actionBar.placeholders.unnamed")}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">{tAgent("actionBar.labels.contentPreview")}:</span>
                  <div className="max-h-24 overflow-y-auto border rounded-md p-2 bg-muted/20 text-xs text-foreground/80">
                    <MarkdownRenderer content={parsedArgs.content as string || tAgent("actionBar.placeholders.noContent")} />
                  </div>
                </div>
                {parsedArgs.tags && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{tAgent("actionBar.labels.tags")}:</span>
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
                    <span className="text-xs font-medium text-muted-foreground">{tAgent("actionBar.labels.title")}:</span>
                    <span className="text-xs text-foreground">{parsedArgs.title}</span>
                  </div>
                )}
                {parsedArgs.description && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-muted-foreground shrink-0">{tAgent("actionBar.labels.description")}:</span>
                    <span className="text-xs text-foreground break-words">{parsedArgs.description}</span>
                  </div>
                )}
                {hasStylePrompt && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-muted-foreground shrink-0">{tAgent("actionBar.labels.artStyle")}:</span>
                    <span className="text-xs text-foreground break-words">{stylePrompt}</span>
                  </div>
                )}
                {!hasStylePrompt && styleId && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{tAgent("actionBar.labels.artStyle")}:</span>
                    {artStyleName ? (
                      <span className="text-xs text-foreground font-medium">{artStyleName}</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{tAgent("actionBar.messages.loading")}</span>
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

              <div ref={containerRef} className="relative flex-1 bg-muted/30 rounded-xl border border-input focus-within:ring-1 focus-within:ring-ring transition-all">
                <AssetReferenceInput
                  ref={inputRef}
                  value={feedbackText}
                  onChange={handleInputChange}
                  onKeyDown={combinedKeyDown}
                  placeholder={t("editor.agent.pendingAction.feedbackPlaceholder")}
                  className="min-h-[20px] text-sm py-1.5 px-2 border-0 shadow-none focus-visible:ring-0 bg-transparent"
                  maxHeight="32px"
                  disabled={isLoading}
                />
                {mentionState.isOpen && (
                  <AssetMentionDropdown
                    ref={dropdownRef}
                    assets={filteredAssets}
                    selectedIndex={selectedIndex}
                    position={mentionState.position}
                    onSelect={insertAssetReference}
                  />
                )}
              </div>

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
                      {tAgent("actionBar.messages.executing")}
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
                      {tAgent("actionBar.messages.processing")}
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
                <div ref={containerRef} className="relative flex-1 bg-muted/30 rounded-xl border border-input focus-within:ring-1 focus-within:ring-ring transition-all">
                  <AssetReferenceInput
                    ref={inputRef}
                    value={feedbackText}
                    onChange={handleInputChange}
                    onKeyDown={combinedKeyDown}
                    placeholder={t("editor.agent.pendingAction.feedbackPlaceholder")}
                    className="min-h-[20px] text-sm py-2 px-2 border-0 shadow-none focus-visible:ring-0 bg-transparent"
                    maxHeight="80px"
                    disabled={isLoading}
                  />
                  {mentionState.isOpen && (
                    <AssetMentionDropdown
                      ref={dropdownRef}
                      assets={filteredAssets}
                      selectedIndex={selectedIndex}
                      position={mentionState.position}
                      onSelect={insertAssetReference}
                    />
                  )}
                </div>
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
