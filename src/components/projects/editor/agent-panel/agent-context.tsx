"use client";

import { createContext, useContext, useReducer, ReactNode, useMemo, useCallback, useEffect } from "react";
import type {
  AgentMessage,
  AgentContext as AgentContextType,
} from "@/types/agent";
import { useEditor } from "../editor-context";

/**
 * Agent 状态
 */
export interface AgentState {
  // 对话历史
  messages: AgentMessage[];
  
  // 是否正在与 AI 通信
  isLoading: boolean;
}

/**
 * Agent 动作类型
 */
type AgentAction =
  | { type: "ADD_MESSAGE"; payload: AgentMessage }
  | { type: "UPDATE_MESSAGE"; payload: { id: string; updates: Partial<AgentMessage> } }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "CLEAR_MESSAGES" }
  | { type: "LOAD_HISTORY"; payload: AgentMessage[] };

/**
 * 初始状态
 */
const initialState: AgentState = {
  messages: [],
  isLoading: false,
};

/**
 * Reducer
 */
function agentReducer(state: AgentState, action: AgentAction): AgentState {
  switch (action.type) {
    case "ADD_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.payload.id ? { ...msg, ...action.payload.updates } : msg
        ),
      };

    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };

    case "CLEAR_MESSAGES":
      return {
        ...state,
        messages: [],
      };

    case "LOAD_HISTORY":
      return {
        ...state,
        messages: action.payload,
      };

    default:
      return state;
  }
}

/**
 * Context 类型
 */
interface AgentContextValue {
  state: AgentState;
  dispatch: React.Dispatch<AgentAction>;
  // 便捷方法
  addMessage: (message: Omit<AgentMessage, "id" | "timestamp">) => string;
  updateMessage: (id: string, updates: Partial<AgentMessage>) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  // 当前上下文（从 EditorContext 获取）
  currentContext: AgentContextType;
}

const AgentContext = createContext<AgentContextValue | null>(null);

/**
 * Provider
 */
interface AgentProviderProps {
  children: ReactNode;
  projectId: string;
}

export function AgentProvider({ children, projectId }: AgentProviderProps) {
  const [state, dispatch] = useReducer(agentReducer, initialState);
  const editorContext = useEditor();

  // 从 localStorage 加载历史记录
  useEffect(() => {
    const storageKey = `agent-history-${projectId}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const history = JSON.parse(stored);
        dispatch({ type: "LOAD_HISTORY", payload: history });
      } catch (error) {
        console.error("加载 Agent 历史记录失败:", error);
      }
    }
  }, [projectId]);

  // 保存历史记录到 localStorage
  useEffect(() => {
    if (state.messages.length > 0) {
      const storageKey = `agent-history-${projectId}`;
      // 只保存最近 50 条消息
      const recentMessages = state.messages.slice(-50);
      localStorage.setItem(storageKey, JSON.stringify(recentMessages));
    }
  }, [state.messages, projectId]);

  // 构建当前上下文
  const currentContext: AgentContextType = useMemo(
    () => ({
      projectId,
      selectedEpisodeId: editorContext.state.selectedEpisodeId,
      selectedShotIds: editorContext.state.selectedShotIds,
      selectedResource: editorContext.state.selectedResource,
      recentJobs: editorContext.jobs.slice(0, 10), // 最近 10 个任务
    }),
    [
      projectId,
      editorContext.state.selectedEpisodeId,
      editorContext.state.selectedShotIds,
      editorContext.state.selectedResource,
      editorContext.jobs,
    ]
  );

  // 便捷方法
  const addMessage = useCallback((message: Omit<AgentMessage, "id" | "timestamp">) => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    dispatch({
      type: "ADD_MESSAGE",
      payload: {
        ...message,
        id,
        timestamp: new Date(),
      },
    });
    return id;
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<AgentMessage>) => {
    dispatch({ type: "UPDATE_MESSAGE", payload: { id, updates } });
  }, []);

  const clearMessages = useCallback(() => {
    dispatch({ type: "CLEAR_MESSAGES" });
    // 清除 localStorage
    const storageKey = `agent-history-${projectId}`;
    localStorage.removeItem(storageKey);
  }, [projectId]);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: "SET_LOADING", payload: loading });
  }, []);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      addMessage,
      updateMessage,
      clearMessages,
      setLoading,
      currentContext,
    }),
    [
      state,
      addMessage,
      updateMessage,
      clearMessages,
      setLoading,
      currentContext,
    ]
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

/**
 * Hook
 */
export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error("useAgent must be used within an AgentProvider");
  }
  return context;
}

