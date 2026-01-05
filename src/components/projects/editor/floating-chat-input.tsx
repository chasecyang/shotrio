"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useAgent } from "./agent-panel/agent-context";
import { useAgentStream } from "./agent-panel/use-agent-stream";
import { useEditor } from "./editor-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Square,
  Maximize2,
  Bot,
  User,
  Check,
  X,
  Coins,
  Loader2,
  AlertCircle,
  GripVertical
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createConversation, saveInterruptMessage, updateConversationTitle } from "@/lib/actions/conversation/crud";
import { generateConversationTitle } from "@/lib/actions/conversation/title-generator";
import { isAwaitingApproval, getPendingToolCall } from "@/lib/services/agent-engine/approval-utils";
import type { AgentMessage } from "@/types/agent";

export type CollapsedPosition = "left" | "right" | "bottom";

interface FloatingChatInputProps {
  projectId: string;
  position: CollapsedPosition;
  onExpand: () => void;
  onPositionChange: (position: CollapsedPosition) => void;
}

// 判断是否为视频相关操作
function isVideoRelatedFunction(functionName: string): boolean {
  const videoRelatedFunctions = [
    'generate_video_asset',
    'generate_image_asset',
    'update_asset',
    'delete_asset',
  ];
  return videoRelatedFunctions.includes(functionName);
}

// 判断是否为项目相关操作
function isProjectRelatedFunction(functionName: string): boolean {
  const projectRelatedFunctions = [
    'update_episode',
    'set_art_style',
  ];
  return projectRelatedFunctions.includes(functionName);
}

// 精简消息预览组件
function MessagePreview({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user";
  const content = message.content || "";

  // 截断长内容
  const truncatedContent = content.length > 100
    ? content.slice(0, 100) + "..."
    : content;

  return (
    <div className={cn(
      "flex items-start gap-2 px-3 py-2 rounded-lg text-sm",
      isUser
        ? "bg-primary/10 ml-8"
        : "bg-muted/50 mr-8"
    )}>
      <div className={cn(
        "shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
        isUser ? "bg-primary/20" : "bg-primary/10"
      )}>
        {isUser
          ? <User className="h-3 w-3 text-primary" />
          : <Bot className="h-3 w-3 text-primary" />
        }
      </div>
      <p className="flex-1 text-foreground/80 line-clamp-2 leading-relaxed">
        {truncatedContent || (message.isStreaming ? "..." : "")}
      </p>
    </div>
  );
}

// 精简版 Pending Action 显示
function CompactPendingAction({
  functionCall,
  creditCost,
  onConfirm,
  onCancel,
  isConfirming,
  isRejecting,
}: {
  functionCall: {
    id: string;
    name: string;
    displayName?: string;
  };
  creditCost?: number;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
  isRejecting?: boolean;
}) {
  const t = useTranslations();
  const isLoading = isConfirming || isRejecting;

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <AlertCircle className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium truncate">
          {functionCall.displayName || functionCall.name}
        </span>
        {creditCost !== undefined && creditCost > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Coins className="h-3 w-3" />
            <span>{creditCost}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          onClick={onCancel}
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          disabled={isLoading}
        >
          {isRejecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          onClick={onConfirm}
          size="sm"
          className="h-7 px-2"
          disabled={isLoading}
        >
          {isConfirming ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

export function FloatingChatInput({ projectId, position, onExpand, onPositionChange }: FloatingChatInputProps) {
  const agent = useAgent();
  const editorContext = useEditor();
  const t = useTranslations();

  const [input, setInput] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleGeneratedRef = useRef<Set<string>>(new Set());
  const dragStartXRef = useRef<number>(0);

  // 获取最近的消息（最多3条）
  const recentMessages = useMemo(() => {
    const filtered = agent.state.messages.filter(msg => msg.role !== "tool");
    return filtered.slice(-3);
  }, [agent.state.messages]);

  // 检查是否有待批准的操作
  const pendingAction = useMemo(() => {
    const messages = agent.state.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      tool_calls: msg.toolCalls,
      tool_call_id: msg.toolCallId,
    }));

    if (!isAwaitingApproval(messages as any[])) {
      return null;
    }

    return getPendingToolCall(messages as any[]);
  }, [agent.state.messages]);

  // 空状态判断
  const isEmptyState = agent.state.isNewConversation || (agent.state.messages.length === 0 && !agent.state.isLoading);

  // 更新对话标题
  const updateTitle = useCallback(async (conversationId: string, userMessage: string) => {
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
      if (success && isVideoRelatedFunction(toolName)) {
        editorContext.refreshJobs();
      }
      if (success && isProjectRelatedFunction(toolName)) {
        editorContext.refreshJobs();
        window.dispatchEvent(new CustomEvent("project-changed"));
      }
    },
    onComplete: () => {
      agent.setLoading(false);
      setTimeout(() => agent.refreshConversations(true), 100);
    },
    onError: (error) => {
      agent.setLoading(false);
      if (error !== "用户中断") {
        toast.error("发送失败");
      }
    },
  });

  // 发送消息
  const handleSend = useCallback(async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");

    if (agent.state.isLoading) {
      abort();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    agent.setLoading(true);

    try {
      // 检查是否有待批准操作
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
          title: t('editor.agent.panel.newConversation'),
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
        updateTitle(conversationId, userMessage);
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
  }, [input, agent, projectId, sendMessage, resumeConversation, t, updateTitle, abort]);

  // 停止生成
  const handleStop = useCallback(() => {
    abort();
    agent.setLoading(false);
    toast.info("已停止生成");
  }, [abort, agent]);

  // 处理确认操作
  const handleConfirm = useCallback(async () => {
    if (!agent.state.currentConversationId) return;

    setIsConfirming(true);
    agent.setLoading(true);

    try {
      await resumeConversation(agent.state.currentConversationId, true);
    } catch (error) {
      console.error("确认操作失败:", error);
      toast.error("操作失败");
    } finally {
      setIsConfirming(false);
    }
  }, [agent, resumeConversation]);

  // 处理拒绝操作
  const handleReject = useCallback(async () => {
    if (!agent.state.currentConversationId) return;

    setIsRejecting(true);
    agent.setLoading(true);

    try {
      await resumeConversation(agent.state.currentConversationId, false);
    } catch (error) {
      console.error("拒绝操作失败:", error);
      toast.error("操作失败");
    } finally {
      setIsRejecting(false);
    }
  }, [agent, resumeConversation]);

  // 键盘快捷键
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

      const threshold = 100;

      // 判断主要移动方向
      const isHorizontalDrag = Math.abs(deltaX) > Math.abs(deltaY);

      if (isHorizontalDrag) {
        // 水平拖动：左右切换
        if (position === "left" && deltaX > threshold) {
          onPositionChange("right");
          setIsDragging(false);
          setDragOffset({ x: 0, y: 0 });
        } else if (position === "right" && deltaX < -threshold) {
          onPositionChange("left");
          setIsDragging(false);
          setDragOffset({ x: 0, y: 0 });
        } else if (position === "bottom") {
          // 从底部拖到左右
          if (deltaX < -threshold) {
            onPositionChange("left");
            setIsDragging(false);
            setDragOffset({ x: 0, y: 0 });
          } else if (deltaX > threshold) {
            onPositionChange("right");
            setIsDragging(false);
            setDragOffset({ x: 0, y: 0 });
          }
        }
      } else {
        // 垂直拖动：上下切换
        if ((position === "left" || position === "right") && deltaY > threshold) {
          onPositionChange("bottom");
          setIsDragging(false);
          setDragOffset({ x: 0, y: 0 });
        } else if (position === "bottom" && deltaY < -threshold) {
          // 从底部向上拖，回到左侧
          onPositionChange("left");
          setIsDragging(false);
          setDragOffset({ x: 0, y: 0 });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, position, onPositionChange]);

  // 底部模式：居中输入框
  if (position === "bottom") {
    return (
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
          "absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xl px-4",
          isDragging && "cursor-grabbing"
        )}
      >
        <div
          className={cn(
            "bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden"
          )}
        >
          {/* 消息预览区域 */}
          {recentMessages.length > 0 && !isEmptyState && (
            <div className="max-h-40 overflow-y-auto p-3 space-y-2 border-b border-border/30">
              {recentMessages.map((msg) => (
                <MessagePreview key={msg.id} message={msg} />
              ))}
              {agent.state.isLoading && !pendingAction && (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>正在思考...</span>
                </div>
              )}
            </div>
          )}

          {/* Pending Action */}
          {pendingAction && (
            <div className="p-3 border-b border-border/30">
              <CompactPendingAction
                functionCall={{
                  id: pendingAction.id,
                  name: pendingAction.function.name,
                }}
                onConfirm={handleConfirm}
                onCancel={handleReject}
                isConfirming={isConfirming}
                isRejecting={isRejecting}
              />
            </div>
          )}

          {/* 输入区域 */}
          <div className="p-3">
            <div className="flex items-end gap-2">
              {/* 拖拽手柄 */}
              <div
                onMouseDown={handleDragStart}
                className={cn(
                  "p-2 rounded-lg cursor-grab hover:bg-muted/50 transition-colors shrink-0",
                  isDragging && "cursor-grabbing"
                )}
                title="拖拽切换位置"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="flex-1 relative">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isEmptyState ? "有什么可以帮你的？" : "继续对话..."}
                  className="min-h-[44px] max-h-[120px] resize-none border-0 bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring rounded-xl px-4 py-3 pr-12"
                />
                <div className="absolute bottom-2 right-2">
                  {agent.state.isLoading && !input.trim() ? (
                    <Button
                      onClick={handleStop}
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8 rounded-lg"
                    >
                      <Square className="h-4 w-4 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSend}
                      disabled={!input.trim()}
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* 展开按钮 */}
              <Button
                onClick={onExpand}
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-xl shrink-0"
                title="展开对话面板"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // 左右侧边栏模式：垂直条形
  return (
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
        "w-16 h-full p-3",
        isDragging && "cursor-grabbing"
      )}
    >
      <div
        className={cn(
          "h-full flex flex-col items-center gap-3 py-4",
          "bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl"
        )}
      >
        {/* 拖拽手柄 */}
        <div
          onMouseDown={handleDragStart}
          className={cn(
            "p-1.5 rounded-lg cursor-grab hover:bg-muted/50 transition-colors",
            isDragging && "cursor-grabbing"
          )}
          title="拖拽切换位置"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Agent 图标 */}
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shrink-0">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>

        {/* 状态指示 */}
        {agent.state.isLoading && (
          <div className="flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}

        {/* 待批准操作指示 */}
        {pendingAction && (
          <div className="flex flex-col items-center gap-1.5">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <div className="flex flex-col gap-1">
              <Button
                onClick={handleConfirm}
                size="icon"
                className="h-7 w-7 rounded-lg"
                disabled={isConfirming || isRejecting}
              >
                {isConfirming ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                onClick={handleReject}
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                disabled={isConfirming || isRejecting}
              >
                {isRejecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* 消息计数 */}
        {recentMessages.length > 0 && !isEmptyState && (
          <div className="text-xs text-muted-foreground font-medium">
            {agent.state.messages.filter(m => m.role !== "tool").length}
          </div>
        )}

        {/* 弹性空间 */}
        <div className="flex-1" />

        {/* 展开按钮 */}
        <Button
          onClick={onExpand}
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-xl shrink-0 hover:bg-primary/10"
          title="展开对话面板"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
