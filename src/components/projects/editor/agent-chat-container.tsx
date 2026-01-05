"use client";

import { useState, useEffect, useCallback } from "react";
import { FloatingChatInput } from "./floating-chat-input";
import { FloatingAgentCard, ExpandedPosition } from "./floating-agent-card";

// localStorage keys
const CHAT_MODE_KEY = "editor:chat-mode";
const CHAT_POSITION_KEY = "editor:chat-expanded-position";

type ChatMode = "collapsed" | "expanded";

interface AgentChatContainerProps {
  projectId: string;
}

export function AgentChatContainer({ projectId }: AgentChatContainerProps) {
  // 状态：默认收起模式
  const [mode, setMode] = useState<ChatMode>("collapsed");
  const [expandedPosition, setExpandedPosition] = useState<ExpandedPosition>("left");
  const [isInitialized, setIsInitialized] = useState(false);

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

  // 等待初始化完成
  if (!isInitialized) {
    return null;
  }

  return (
    <>
      {mode === "collapsed" ? (
        <FloatingChatInput
          projectId={projectId}
          onExpand={handleExpand}
        />
      ) : (
        <FloatingAgentCard
          projectId={projectId}
          position={expandedPosition}
          onPositionChange={handlePositionChange}
          onCollapse={handleCollapse}
        />
      )}
    </>
  );
}
