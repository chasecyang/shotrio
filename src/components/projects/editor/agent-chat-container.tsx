"use client";

import { useState, useEffect, useCallback } from "react";
import { FloatingChatInput } from "./floating-chat-input";
import { FloatingAgentCard, ExpandedPosition } from "./floating-agent-card";
import { AgentChatSkeleton } from "./agent-chat-skeleton";
import { useAgent } from "./agent-panel/agent-context";
import { cn } from "@/lib/utils";

// localStorage keys
const CHAT_MODE_KEY = "editor:chat-mode";
const CHAT_POSITION_KEY = "editor:chat-expanded-position";

type ChatMode = "collapsed" | "expanded";

interface AgentChatContainerProps {
  projectId: string;
}

export function AgentChatContainer({ projectId }: AgentChatContainerProps) {
  const agent = useAgent();
  // 状态：默认展开模式
  const [mode, setMode] = useState<ChatMode>("expanded");
  const [expandedPosition, setExpandedPosition] = useState<ExpandedPosition>("left");
  const [isInitialized, setIsInitialized] = useState(false);
  // 拖拽预览状态（仅展开时使用）
  const [targetPosition, setTargetPosition] = useState<ExpandedPosition | null>(null);

  // 从 localStorage 恢复状态
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem(CHAT_MODE_KEY) as ChatMode | null;
      const savedPosition = localStorage.getItem(CHAT_POSITION_KEY) as ExpandedPosition | null;

      if (savedMode === "collapsed" || savedMode === "expanded") {
        setMode(savedMode);
      }
      if (savedPosition === "left" || savedPosition === "right") {
        setExpandedPosition(savedPosition);
      }
    } catch (error) {
      console.error("读取聊天模式设置失败:", error);
    }
    setIsInitialized(true);
  }, []);

  // 保存模式到 localStorage
  const handleModeChange = useCallback((newMode: ChatMode) => {
    setMode(newMode);
    try {
      localStorage.setItem(CHAT_MODE_KEY, newMode);
    } catch (error) {
      console.error("保存聊天模式失败:", error);
    }
  }, []);

  // 保存位置到 localStorage
  const handlePositionChange = useCallback((newPosition: ExpandedPosition) => {
    setExpandedPosition(newPosition);
    try {
      localStorage.setItem(CHAT_POSITION_KEY, newPosition);
    } catch (error) {
      console.error("保存聊天位置失败:", error);
    }
  }, []);

  // 展开
  const handleExpand = useCallback(() => {
    handleModeChange("expanded");
  }, [handleModeChange]);

  // 收起
  const handleCollapse = useCallback(() => {
    handleModeChange("collapsed");
  }, [handleModeChange]);

  // 处理目标位置变更（拖拽预览）
  const handleTargetPositionChange = useCallback((target: ExpandedPosition | null) => {
    setTargetPosition(target);
  }, []);

  // 等待初始化完成（localStorage 配置 + 对话恢复），显示骨架屏
  if (!isInitialized || !agent.state.isInitialLoadComplete) {
    return <AgentChatSkeleton position={expandedPosition} />;
  }

  // 收起状态：悬浮球固定在右下角
  if (mode === "collapsed") {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <FloatingChatInput onExpand={handleExpand} />
      </div>
    );
  }

  // 展开状态的预览区域组件
  const PreviewOverlay = targetPosition && (
    <div className="fixed inset-0 pointer-events-none z-30">
      <div className={cn(
        "absolute bg-primary/10 border-2 border-dashed border-primary/50 rounded-lg",
        "transition-opacity duration-150 animate-in fade-in",
        targetPosition === "left" && "left-3 top-3 w-[380px] h-[calc(100%-24px)]",
        targetPosition === "right" && "right-3 top-3 w-[380px] h-[calc(100%-24px)]",
        targetPosition === "bottom" && "bottom-4 left-4 right-4 h-[420px]"
      )} />
    </div>
  );

  // 底部模式：使用 absolute 定位浮动
  if (expandedPosition === "bottom") {
    return (
      <>
        {PreviewOverlay}
        <div className="absolute inset-0 pointer-events-none z-20">
          <div className="pointer-events-auto">
            <FloatingAgentCard
              projectId={projectId}
              position={expandedPosition}
              onPositionChange={handlePositionChange}
              onCollapse={handleCollapse}
              onTargetPositionChange={handleTargetPositionChange}
            />
          </div>
        </div>
      </>
    );
  }

  // 左右模式：使用 flex 布局，挤压中间内容
  return (
    <>
      {PreviewOverlay}
      <div
        className={cn(
          "shrink-0 h-full transition-all duration-300 ease-out",
          expandedPosition === "right" ? "order-last" : "order-first"
        )}
      >
        <FloatingAgentCard
          projectId={projectId}
          position={expandedPosition}
          onPositionChange={handlePositionChange}
          onCollapse={handleCollapse}
          onTargetPositionChange={handleTargetPositionChange}
        />
      </div>
    </>
  );
}
