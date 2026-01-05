"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useAgent } from "./agent-panel/agent-context";
import { useAgentStream } from "./agent-panel/use-agent-stream";
import { Button } from "@/components/ui/button";
import {
  Maximize2,
  Bot,
  Check,
  X,
  Loader2,
  AlertCircle,
  GripVertical
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isAwaitingApproval, getPendingToolCall } from "@/lib/services/agent-engine/approval-utils";

export type CollapsedPosition = "left" | "right";

interface FloatingChatInputProps {
  position: CollapsedPosition;
  onExpand: () => void;
  onPositionChange: (position: CollapsedPosition) => void;
  onTargetPositionChange?: (target: CollapsedPosition | null) => void;
}

export function FloatingChatInput({ position, onExpand, onPositionChange, onTargetPositionChange }: FloatingChatInputProps) {
  const agent = useAgent();

  const [isConfirming, setIsConfirming] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [targetPosition, setTargetPosition] = useState<CollapsedPosition | null>(null);
  const dragStartXRef = useRef<number>(0);
  const dragStartYRef = useRef<number>(0);

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

  // Agent Stream Hook - 只用于恢复对话
  const { resumeConversation } = useAgentStream({
    onComplete: () => {
      agent.setLoading(false);
      setTimeout(() => agent.refreshConversations(true), 100);
    },
    onError: (error) => {
      agent.setLoading(false);
      if (error !== "用户中断") {
        toast.error("操作失败");
      }
    },
  });

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

      let newTarget: CollapsedPosition | null = null;

      // 水平拖动：左右切换
      if (position === "left" && deltaX > horizontalThreshold) {
        newTarget = "right";
      } else if (position === "right" && deltaX < -horizontalThreshold) {
        newTarget = "left";
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
