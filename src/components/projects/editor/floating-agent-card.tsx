"use client";

import { useState, useRef, useEffect, useCallback, useMemo, memo, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useAgent } from "./agent-panel/agent-context";
import { useAgentStream } from "./agent-panel/use-agent-stream";
import { useEditor } from "./editor-context";
import { ChatMessage } from "./agent-panel/chat-message";
import { TypingIndicator } from "./agent-panel/typing-indicator";
import { AutoModeToggle } from "./agent-panel/auto-mode-toggle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Square,
  Minimize2,
  Bot,
  ArrowDown,
  GripVertical,
  ChevronDown,
  MessageSquarePlus,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  X
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createConversation, saveInterruptMessage, updateConversationTitle } from "@/lib/actions/conversation/crud";
import { generateConversationTitle } from "@/lib/actions/conversation/title-generator";
import { isAwaitingApproval, findPendingApproval } from "@/lib/services/agent-engine/approval-utils";
import { useCreditsInfo } from "@/hooks/use-credits-info";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ApprovalActionBar } from "./agent-panel/approval-action-bar";
import { getFunctionDefinition } from "@/lib/actions/agent/functions";

export type ExpandedPosition = "left" | "right" | "bottom";

interface FloatingAgentCardProps {
  projectId: string;
  position: ExpandedPosition;
  onPositionChange: (position: ExpandedPosition) => void;
  onCollapse: () => void;
  onTargetPositionChange?: (target: ExpandedPosition | null) => void;
  pendingMessage?: {
    conversationId: string;
    message: string;
  } | null;
  onPendingMessageHandled?: () => void;
}

// 判断是否为素材相关操作
function isAssetModifyingFunction(functionName: string): boolean {
  return [
    'generate_video_asset',
    'generate_image_asset',
    'create_text_asset',
    'update_asset',
    'delete_asset',
  ].includes(functionName);
}

// 判断是否为项目相关操作
function isProjectRelatedFunction(functionName: string): boolean {
  return ['update_episode', 'set_project_info'].includes(functionName);
}

// 判断是否为消耗积分的操作
function isCreditConsumingFunction(functionName: string): boolean {
  return ['generate_video_asset', 'generate_image_asset'].includes(functionName);
}

interface AutoModeBarProps {
  isBottomMode?: boolean;
  onExit: () => void;
  t: (key: string) => string;
  asOverlay?: boolean;
}

const AutoModeBar = memo(function AutoModeBar({ isBottomMode, onExit, t, asOverlay }: AutoModeBarProps) {
  const content = (
    <div className="pointer-events-auto p-3">
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-xl border border-input bg-background/90 shadow-lg backdrop-blur px-3 py-2",
          isBottomMode ? "min-h-[48px]" : "min-h-[56px]"
        )}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span>{t("editor.agent.panel.autoModeProcessing")}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onExit}
          className={cn("gap-1", isBottomMode ? "h-7 px-2 text-xs" : "h-8")}
        >
          <X className="h-3.5 w-3.5" />
          {t("editor.agent.panel.exitAutoMode")}
        </Button>
      </div>
    </div>
  );

  return asOverlay ? (
    <div className="absolute inset-x-0 bottom-0 top-[60%] z-10 flex items-center justify-center bg-background/40 backdrop-blur-sm">
      {content}
    </div>
  ) : content;
});

interface ChatInputAreaProps {
  input: string;
  onInputChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStop: () => void;
  isLoading: boolean;
  isEmptyState: boolean;
  isBottomMode?: boolean;
  showHint?: boolean;
  placeholder: string;
  emptyPlaceholder: string;
  stopToInterruptLabel: string;
  enterToSendLabel: string;
}

function ChatInputArea({
  input,
  onInputChange,
  onKeyDown,
  onSend,
  onStop,
  isLoading,
  isEmptyState,
  isBottomMode,
  showHint,
  placeholder,
  emptyPlaceholder,
  stopToInterruptLabel,
  enterToSendLabel,
}: ChatInputAreaProps) {
  return (
    <div className="border-t p-3 shrink-0 bg-background/80">
      <div className="relative flex items-end w-full p-2 bg-muted/30 rounded-xl border border-input focus-within:ring-1 focus-within:ring-ring transition-all">
        <Textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={isEmptyState ? emptyPlaceholder : placeholder}
          className={cn(
            "min-h-[20px] w-full resize-none border-0 shadow-none focus-visible:ring-0 p-2 bg-transparent pr-12",
            isBottomMode ? "max-h-[80px]" : "max-h-[150px]"
          )}
          style={{ height: 'auto', minHeight: '40px' }}
        />
        <div className="absolute bottom-2 right-2">
          {isLoading && !input.trim() ? (
            <Button
              onClick={onStop}
              size="icon"
              variant="destructive"
              className="h-8 w-8 rounded-lg"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              onClick={onSend}
              disabled={!input.trim()}
              size="icon"
              className="h-8 w-8 rounded-lg"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      {showHint && (
        <p className="mt-2 text-xs text-center text-muted-foreground/60">
          {isLoading
            ? (input.trim() ? "发送消息将中断当前输出" : stopToInterruptLabel)
            : enterToSendLabel}
        </p>
      )}
    </div>
  );
}


export function FloatingAgentCard({
  projectId,
  position,
  onPositionChange,
  onCollapse,
  onTargetPositionChange,
  pendingMessage,
  onPendingMessageHandled,
}: FloatingAgentCardProps) {
  const agent = useAgent();
  const editorContext = useEditor();
  const t = useTranslations();
  const { balance } = useCreditsInfo();
  const creditBalance = balance ?? undefined;

  const [input, setInput] = useState("");
  const [isUserNearBottom, setIsUserNearBottom] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [targetPosition, setTargetPosition] = useState<ExpandedPosition | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const titleGeneratedRef = useRef<Set<string>>(new Set());
  const dragStartXRef = useRef<number>(0);
  const pendingMessageHandledRef = useRef(false);

  // 监听 pendingEditAsset，预填充输入框
  useEffect(() => {
    if (editorContext.state.pendingEditAsset) {
      const asset = editorContext.state.pendingEditAsset;
      const prefillText = `请帮我编辑图片「${asset.name}」`;
      setInput(prefillText);
      // 清除 pendingEditAsset 避免重复触发
      editorContext.setPendingEditAsset(null);
    }
  }, [editorContext.state.pendingEditAsset, editorContext.setPendingEditAsset]);

  // 空状态判断
  const isEmptyState = agent.state.isNewConversation || (agent.state.messages.length === 0 && !agent.state.isLoading);

  // 检测待审批操作
  const pendingApproval = useMemo(() => {
    const messages = agent.state.messages.map(msg => ({
      role: msg.role,
      content: msg.content || "",
      tool_calls: msg.toolCalls,
      tool_call_id: msg.toolCallId,
    }));

    const approval = findPendingApproval(messages as any[]);
    if (!approval) return null;

    const funcDef = getFunctionDefinition(approval.toolCall.function.name);
    if (!funcDef) return null;

    return {
      toolCall: approval.toolCall,
      funcDef,
    };
  }, [agent.state.messages]);


  // 检测用户是否在底部
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const threshold = 100;
    const nearBottom = scrollHeight - scrollTop - clientHeight < threshold;
    setIsUserNearBottom(nearBottom);
  }, []);

  // 滚动到底部
  const scrollToBottom = useCallback((smooth = false) => {
    if (!scrollRef.current) return;
    if (smooth) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // 更新对话标题
  const updateConversationTitleFromMessage = useCallback(async (
    conversationId: string,
    userMessage: string
  ) => {
    if (titleGeneratedRef.current.has(conversationId)) return;

    try {
      const generatedTitle = await generateConversationTitle(userMessage);
      const result = await updateConversationTitle(conversationId, generatedTitle);

      if (result.success) {
        titleGeneratedRef.current.add(conversationId);
        agent.dispatch({
          type: "UPDATE_CONVERSATION_TITLE",
          payload: { conversationId, title: generatedTitle },
        });
        agent.refreshConversations(true);
      }
    } catch (error) {
      console.error("更新对话标题失败:", error);
    }
  }, [agent]);

  // Agent Stream Hook
  const { sendMessage, abort, resumeConversation } = useAgentStream({
    onToolCallEnd: (toolName: string, success: boolean) => {
      if (!success) return;

      if (isAssetModifyingFunction(toolName)) {
        editorContext.refreshJobs();
        window.dispatchEvent(new CustomEvent("asset-created"));
      }

      if (isProjectRelatedFunction(toolName)) {
        window.dispatchEvent(new CustomEvent("project-changed"));
      }

      if (isCreditConsumingFunction(toolName)) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("credits-changed"));
        }, 1000);
      }
    },
    onComplete: () => {
      agent.setLoading(false);
      agent.setAutoAccept(false); // 对话结束后自动退出自动模式
      setTimeout(() => agent.refreshConversations(true), 100);
    },
    onError: (error) => {
      agent.setLoading(false);
      if (error !== "用户中断") {
        toast.error("发送失败");
      }
    },
  });

  // 处理来自首页的 pending 消息（复用已创建的 conversationId）
  useEffect(() => {
    // 必须等待 AgentProvider 初始化完成
    if (!agent.state.isInitialLoadComplete) return;
    if (!pendingMessage || pendingMessageHandledRef.current) return;

    const timer = setTimeout(async () => {
      // 在 setTimeout 内部再次检查，避免竞态条件：
      // 当依赖变化时 useEffect 会重新执行，清理函数取消 timer，
      // 但如果标记在外部设置，后续执行会直接跳过
      if (pendingMessageHandledRef.current) return;
      pendingMessageHandledRef.current = true;

      try {
        const { conversationId, message } = pendingMessage;

        // 设置当前对话ID（复用首页已创建的对话）
        agent.dispatch({
          type: "SET_CURRENT_CONVERSATION",
          payload: conversationId,
        });
        agent.dispatch({ type: "SET_NEW_CONVERSATION", payload: false });

        // 保存到 localStorage
        try {
          localStorage.setItem(
            `editor:project:${projectId}:conversationId`,
            conversationId
          );
        } catch {}

        // 添加用户消息到 UI
        agent.addMessage({
          role: "user",
          content: message,
        });

        // 发送消息给 Agent
        agent.setLoading(true);
        await sendMessage(message, agent.currentContext, conversationId);

        // 刷新对话列表
        agent.refreshConversations(true);
      } catch (error) {
        console.error("处理首页消息失败:", error);
        toast.error("启动对话失败");
      } finally {
        onPendingMessageHandled?.();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [pendingMessage, agent.state.isInitialLoadComplete, projectId, agent, sendMessage, onPendingMessageHandled]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current && isUserNearBottom) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agent.state.messages, agent.state.isLoading, isUserNearBottom]);

  // 发送消息（支持直接传入消息内容，用于自动发送）
  const handleSend = useCallback(async (messageOverride?: string) => {
    const userMessage = messageOverride?.trim() || input.trim();
    if (!userMessage) return;

    if (!messageOverride) {
      setInput("");
    }

    if (agent.state.isLoading) {
      abort();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    agent.setLoading(true);

    try {
      const messages = agent.state.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        tool_calls: msg.toolCalls,
        tool_call_id: msg.toolCallId,
      }));

      const hasAwaitingApproval = isAwaitingApproval(messages as any[]);

      if (hasAwaitingApproval && agent.state.currentConversationId) {
        const saveResult = await saveInterruptMessage(
          agent.state.currentConversationId,
          userMessage
        );

        if (saveResult.success && saveResult.messageId) {
          agent.addMessage({
            id: saveResult.messageId,
            role: "user",
            content: userMessage,
          });
        }

        await resumeConversation(agent.state.currentConversationId, false);
        return;
      }

      let conversationId = agent.state.currentConversationId;

      if (agent.state.isNewConversation || !conversationId) {
        const result = await createConversation({
          projectId,
          title: t('editor.agent.panel.newChat'),
          context: agent.currentContext
        });

        if (!result.success || !result.conversationId) {
          toast.error(result.error || "创建对话失败");
          agent.setLoading(false);
          return;
        }

        conversationId = result.conversationId;
        agent.dispatch({ type: "SET_CURRENT_CONVERSATION", payload: conversationId });
        agent.dispatch({ type: "SET_NEW_CONVERSATION", payload: false });
        updateConversationTitleFromMessage(conversationId, userMessage);
        agent.refreshConversations(true);
      }

      agent.addMessage({
        role: "user",
        content: userMessage,
      });

      await sendMessage(userMessage, agent.currentContext, conversationId);
    } catch (error) {
      agent.setLoading(false);
      console.error("发送消息失败:", error);
      toast.error("发送失败");
    }
  }, [input, agent, projectId, sendMessage, resumeConversation, t, updateConversationTitleFromMessage, abort]);

  // 停止生成
  const handleStop = useCallback(() => {
    abort();
    agent.setLoading(false);
    toast.info("已停止生成");
  }, [abort, agent]);

  // 键盘快捷键
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        handleSend();
      }
    }
  }, [handleSend, input]);

  // 拖拽处理
  const dragStartYRef = useRef<number>(0);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartYRef.current = e.clientY;
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartXRef.current;
      const deltaY = e.clientY - dragStartYRef.current;

      // 实时更新拖动偏移
      setDragOffset({ x: deltaX, y: deltaY });

      const horizontalThreshold = 100;
      const verticalThreshold = 60; // 垂直方向更容易触发
      const isHorizontalDrag = Math.abs(deltaX) > Math.abs(deltaY);

      let newTarget: ExpandedPosition | null = null;

      if (isHorizontalDrag) {
        // 水平拖动：左右切换
        if (position === "left" && deltaX > horizontalThreshold) {
          newTarget = "right";
        } else if (position === "right" && deltaX < -horizontalThreshold) {
          newTarget = "left";
  } else if (position === "bottom") {
          if (deltaX < -horizontalThreshold) {
            newTarget = "left";
          } else if (deltaX > horizontalThreshold) {
            newTarget = "right";
          }
        }
      } else {
        // 垂直拖动：上下切换
        if ((position === "left" || position === "right") && deltaY > verticalThreshold) {
          newTarget = "bottom";
        } else if (position === "bottom" && deltaY < -verticalThreshold) {
          newTarget = "left";
        }
      }

      // 更新目标位置状态
      setTargetPosition(newTarget);
      onTargetPositionChange?.(newTarget);
    };

    const handleMouseUp = () => {
      // 松开时才应用位置变更
      if (targetPosition && targetPosition !== position) {
        onPositionChange(targetPosition);
      }
      // 重置所有状态
      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
      setTargetPosition(null);
      onTargetPositionChange?.(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, position, onPositionChange, targetPosition, onTargetPositionChange]);

  // 对话管理
  const handleCreateNewConversation = useCallback(() => {
    agent.createNewConversation();
  }, [agent]);

  const handleDeleteClick = useCallback((conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (conversationToDelete) {
      await agent.deleteConversationById(conversationToDelete);
      setConversationToDelete(null);
    }
    setDeleteDialogOpen(false);
  }, [agent, conversationToDelete]);

  // 格式化时间
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return new Date(date).toLocaleDateString();
  };

  // 状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "awaiting_approval":
        return { Icon: AlertCircle, className: "text-amber-600 dark:text-amber-400" };
      case "active":
        return { Icon: Clock, className: "text-blue-500" };
      case "completed":
        return { Icon: CheckCircle, className: "text-muted-foreground" };
      default:
        return { Icon: MessageSquarePlus, className: "text-muted-foreground" };
    }
  };

  // 删除确认对话框 - 统一定义，避免重复
  const deleteDialog = (
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除这个对话吗？此操作无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmDelete}>
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const renderHeader = (showCollapse: boolean) => (
    <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* 拖拽手柄 */}
        <div
          onMouseDown={handleDragStart}
          className={cn(
            "p-1 rounded cursor-grab hover:bg-muted/50 transition-colors",
            isDragging && "cursor-grabbing"
          )}
          title="拖拽切换位置"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shrink-0">
          <Bot className="h-4 w-4 text-primary-foreground" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto p-0 hover:bg-transparent flex-1 justify-start min-w-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h3 className="text-sm font-semibold truncate">
                  {agent.state.isNewConversation
                    ? t('editor.agent.panel.newChat')
                    : agent.state.conversations.find(c => c.id === agent.state.currentConversationId)?.title || t('editor.agent.panel.aiAssistant')}
                </h3>
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[300px]">
            <DropdownMenuItem onClick={handleCreateNewConversation} className="font-medium">
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              新建对话
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="max-h-[300px] overflow-y-auto">
              {agent.state.conversations.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  暂无对话历史
                </div>
              ) : (
                agent.state.conversations.map((conv) => {
                  const { Icon, className } = getStatusIcon(conv.status);
                  const isActive = conv.id === agent.state.currentConversationId;

                  return (
                    <DropdownMenuItem
                      key={conv.id}
                      onClick={() => agent.loadConversation(conv.id)}
                      className={cn(
                        "flex items-start gap-2 py-2 px-2 cursor-pointer",
                        isActive && "bg-accent"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", className)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{conv.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(conv.lastActivityAt)}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleDeleteClick(conv.id, e)}
                        className="h-6 w-6 shrink-0 opacity-0 hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </DropdownMenuItem>
                  );
                })
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-1">
        <AutoModeToggle />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCreateNewConversation}
              className="shrink-0"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('editor.agent.panel.newChat')}</p>
          </TooltipContent>
        </Tooltip>

        {showCollapse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCollapse}
                className="shrink-0"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>收起</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );

  const renderMessagesArea = (compact: boolean) => (
    <div
      className={cn(
        "flex-1 overflow-hidden relative",
        compact ? "min-h-[60px] max-h-[80px]" : undefined
      )}
    >
      <div ref={scrollRef} className="h-full overflow-y-auto overflow-x-hidden" onScroll={handleScroll}>
        <div className="py-2">
          {isEmptyState ? (
            <div className={cn(
              "flex h-full flex-col items-center justify-center text-center",
              compact ? "p-4" : "p-8"
            )}>
              <Bot className={cn(
                "text-muted-foreground/60",
                compact ? "mb-2 h-6 w-6" : "mb-3 h-8 w-8"
              )} />
              <p className="text-sm text-muted-foreground/80">
                {t('editor.agent.panel.emptyState')}
              </p>
            </div>
          ) : (
            <>
              {agent.state.messages
                .filter(msg => msg.role !== "tool")
                .map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                  />
                ))}
              {agent.state.isLoading && <TypingIndicator />}
            </>
          )}
        </div>
      </div>

      {!isUserNearBottom && (
        <div className={cn(
          "absolute z-10",
          compact ? "bottom-2 right-4" : "bottom-4 right-4"
        )}>
          <Button
            size="icon"
            onClick={() => scrollToBottom(true)}
            className={cn(
              "rounded-full shadow-lg",
              compact ? "h-8 w-8" : "h-9 w-9"
            )}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );

  // 底部模式的布局
  if (position === "bottom") {
    const bottomContent = (
      <motion.div
        animate={{
          x: dragOffset.x,
          y: dragOffset.y,
          scale: isDragging ? 0.97 : 1,
          opacity: isDragging ? 0.85 : 1,
        }}
        transition={isDragging ? {
          type: "tween",
          duration: 0,
        } : {
          type: "spring",
          stiffness: 400,
          damping: 25,
        }}
        className={cn(
          "absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4",
          isDragging && "cursor-grabbing"
        )}
      >
        <div
          className={cn(
            "max-h-[400px]",
            "bg-background dark:bg-surface border border-border rounded-2xl",
            "flex flex-col overflow-hidden"
          )}
        >
          {renderHeader(false)}

          {/* Messages and Action Area Container with Auto Mode Overlay */}
          <div className="relative flex-1 flex flex-col overflow-hidden">
            {renderMessagesArea(true)}

            {/* Input or Approval Action Bar */}
            <div className="relative">
              {pendingApproval ? (
                <ApprovalActionBar
                  approvalInfo={pendingApproval}
                  currentBalance={creditBalance}
                  isBottomMode
                />
              ) : (
                <ChatInputArea
                  input={input}
                  onInputChange={setInput}
                  onKeyDown={handleKeyDown}
                  onSend={handleSend}
                  onStop={handleStop}
                  isLoading={agent.state.isLoading}
                  isEmptyState={isEmptyState}
                  isBottomMode
                  placeholder={t("editor.agent.chatInput.placeholder")}
                  emptyPlaceholder={t("editor.agent.chatInput.emptyPlaceholder")}
                  stopToInterruptLabel={t("editor.agent.chatInput.stopToInterrupt")}
                  enterToSendLabel={t("editor.agent.chatInput.enterToSend")}
                />
              )}
            </div>

            {/* Auto Mode Overlay */}
            {agent.state.isAutoAcceptEnabled && (
              <AutoModeBar
                isBottomMode
                onExit={() => agent.setAutoAccept(false)}
                t={t}
                asOverlay
              />
            )}
          </div>
        </div>
      </motion.div>
    );

    return (
      <>
        {bottomContent}
        {deleteDialog}
      </>
    );
  }

  // 左右侧边栏模式
  const sidebarContent = (
    <motion.div
      animate={{
        x: dragOffset.x,
        y: dragOffset.y,
        scale: isDragging ? 0.97 : 1,
        opacity: isDragging ? 0.85 : 1,
      }}
      transition={isDragging ? {
        type: "tween",
        duration: 0,
      } : {
        type: "spring",
        stiffness: 400,
        damping: 25,
      }}
      className={cn(
        "w-[380px] h-full",
        isDragging && "cursor-grabbing"
      )}
    >
      <div
        className={cn(
          "h-full",
          "bg-background dark:bg-surface border border-border rounded-2xl",
          "flex flex-col overflow-hidden"
        )}
      >
        {renderHeader(true)}

        {/* Messages and Action Area Container with Auto Mode Overlay */}
        <div className="relative flex-1 flex flex-col overflow-hidden">
          {renderMessagesArea(false)}

          {/* Input or Approval Action Bar */}
          <div className="relative">
            {pendingApproval ? (
              <ApprovalActionBar
                approvalInfo={pendingApproval}
                currentBalance={creditBalance}
              />
            ) : (
              <ChatInputArea
                input={input}
                onInputChange={setInput}
                onKeyDown={handleKeyDown}
                onSend={handleSend}
                onStop={handleStop}
                isLoading={agent.state.isLoading}
                isEmptyState={isEmptyState}
                showHint
                placeholder={t("editor.agent.chatInput.placeholder")}
                emptyPlaceholder={t("editor.agent.chatInput.emptyPlaceholder")}
                stopToInterruptLabel={t("editor.agent.chatInput.stopToInterrupt")}
                enterToSendLabel={t("editor.agent.chatInput.enterToSend")}
              />
            )}
          </div>

          {/* Auto Mode Overlay */}
          {agent.state.isAutoAcceptEnabled && (
            <AutoModeBar
              onExit={() => agent.setAutoAccept(false)}
              t={t}
              asOverlay
            />
          )}
        </div>
      </div>
    </motion.div>
  );

  return (
    <>
      {sidebarContent}
      {deleteDialog}
    </>
  );
}
