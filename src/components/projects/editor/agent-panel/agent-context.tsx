"use client";

import { createContext, useContext, useReducer, ReactNode, useMemo, useCallback, useEffect, useRef } from "react";
import type {
  AgentMessage,
  AgentContext as AgentContextType,
} from "@/types/agent";
import { useEditor } from "../editor-context";
import {
  listConversations,
  getConversation,
  deleteConversation,
} from "@/lib/actions/conversation/crud";
import { toast } from "sonner";

// localStorage key
const getConversationStorageKey = (projectId: string) => `editor:project:${projectId}:conversationId`;

/**
 * 对话信息
 */
export interface Conversation {
  id: string;
  title: string;
  status: "active" | "awaiting_approval" | "completed";
  lastActivityAt: Date;
}

/**
 * Agent 状态
 */
export interface AgentState {
  // 对话历史
  messages: AgentMessage[];
  
  // 是否正在与 AI 通信
  isLoading: boolean;

  // 当前对话ID
  currentConversationId: string | null;

  // 对话列表
  conversations: Conversation[];

  // 是否正在加载对话列表（初始加载）
  isLoadingConversations: boolean;

  // 是否正在刷新对话列表（静默刷新）
  isRefreshingConversations: boolean;

  // 是否处于"新对话"模式（懒创建）
  isNewConversation: boolean;

  // 是否启用自动执行模式（当前会话有效）
  isAutoAcceptEnabled: boolean;

  // 初始加载是否完成（对话列表加载+恢复逻辑）
  isInitialLoadComplete: boolean;
}

/**
 * Agent 动作类型
 */
type AgentAction =
  | { type: "ADD_MESSAGE"; payload: AgentMessage }
  | { type: "UPDATE_MESSAGE"; payload: { id: string; updates: Partial<AgentMessage> } }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "CLEAR_MESSAGES" }
  | { type: "LOAD_HISTORY"; payload: AgentMessage[] }
  | { type: "SET_CURRENT_CONVERSATION"; payload: string | null }
  | { type: "SET_CONVERSATIONS"; payload: Conversation[] }
  | { type: "SET_LOADING_CONVERSATIONS"; payload: boolean }
  | { type: "SET_REFRESHING_CONVERSATIONS"; payload: boolean }
  | { type: "SET_NEW_CONVERSATION"; payload: boolean }
  | { type: "UPDATE_CONVERSATION_TITLE"; payload: { conversationId: string; title: string } }
  | { type: "SET_AUTO_ACCEPT"; payload: boolean }
  | { type: "SET_INITIAL_LOAD_COMPLETE"; payload: boolean };

/**
 * 初始状态
 */
const initialState: AgentState = {
  messages: [],
  isLoading: false,
  currentConversationId: null,
  conversations: [],
  isLoadingConversations: false,
  isRefreshingConversations: false,
  isNewConversation: false, // 等待恢复逻辑确定后再设置
  isAutoAcceptEnabled: false, // 默认关闭自动执行模式
  isInitialLoadComplete: false, // 初始加载未完成
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

    case "SET_CURRENT_CONVERSATION":
      return {
        ...state,
        currentConversationId: action.payload,
      };

    case "SET_CONVERSATIONS":
      return {
        ...state,
        conversations: action.payload,
      };

    case "SET_LOADING_CONVERSATIONS":
      return {
        ...state,
        isLoadingConversations: action.payload,
      };

    case "SET_REFRESHING_CONVERSATIONS":
      return {
        ...state,
        isRefreshingConversations: action.payload,
      };

    case "SET_NEW_CONVERSATION":
      return {
        ...state,
        isNewConversation: action.payload,
      };

    case "UPDATE_CONVERSATION_TITLE":
      return {
        ...state,
        conversations: state.conversations.map((conv) =>
          conv.id === action.payload.conversationId
            ? { ...conv, title: action.payload.title }
            : conv
        ),
      };

    case "SET_AUTO_ACCEPT":
      return {
        ...state,
        isAutoAcceptEnabled: action.payload,
      };

    case "SET_INITIAL_LOAD_COMPLETE":
      return {
        ...state,
        isInitialLoadComplete: action.payload,
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
  addMessage: (message: Omit<AgentMessage, "timestamp" | "id"> & { id?: string }) => string;
  updateMessage: (id: string, updates: Partial<AgentMessage>) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  // 对话管理方法
  loadConversation: (conversationId: string) => Promise<void>;
  createNewConversation: () => void;
  deleteConversationById: (conversationId: string) => Promise<void>;
  refreshConversations: (silent?: boolean) => Promise<void>;
  // 自动执行模式
  setAutoAccept: (enabled: boolean) => void;
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

  // 防抖：跟踪刷新状态，避免并发刷新
  const isRefreshingRef = useRef(false);
  const lastRefreshTimeRef = useRef(0);

  // 刷新对话列表（带防抖，仅用于手动刷新，初始加载使用 initializeAgent）
  const refreshConversations = useCallback(async (silent: boolean = false) => {
    // 防止并发刷新
    if (isRefreshingRef.current) return;

    // 防抖：1秒内不重复刷新
    const now = Date.now();
    if (now - lastRefreshTimeRef.current < 1000) return;

    isRefreshingRef.current = true;
    lastRefreshTimeRef.current = now;

    if (!silent) {
      dispatch({ type: "SET_REFRESHING_CONVERSATIONS", payload: true });
    }

    try {
      const result = await listConversations(projectId);
      if (result.success && result.conversations) {
        dispatch({
          type: "SET_CONVERSATIONS",
          payload: result.conversations.map((conv) => ({
            id: conv.id,
            title: conv.title,
            status: conv.status as "active" | "awaiting_approval" | "completed",
            lastActivityAt: new Date(conv.lastActivityAt),
          })),
        });
      }
    } catch (error) {
      console.error("刷新对话列表失败:", error);
    } finally {
      if (!silent) {
        dispatch({ type: "SET_REFRESHING_CONVERSATIONS", payload: false });
      }
      isRefreshingRef.current = false;
    }
  }, [projectId]);

  // 加载指定对话
  const loadConversation = useCallback(async (conversationId: string) => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const result = await getConversation(conversationId);
      if (result.success && result.messages) {
        dispatch({ type: "LOAD_HISTORY", payload: result.messages });
        dispatch({ type: "SET_CURRENT_CONVERSATION", payload: conversationId });
        dispatch({ type: "SET_NEW_CONVERSATION", payload: false });
        dispatch({ type: "SET_AUTO_ACCEPT", payload: false }); // 切换对话时重置自动模式
        // 保存到 localStorage
        try {
          localStorage.setItem(getConversationStorageKey(projectId), conversationId);
        } catch {}
      } else {
        toast.error(result.error || "加载对话失败");
      }
    } catch (error) {
      console.error("[Agent] 加载对话失败:", error);
      toast.error("加载对话失败");
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [projectId]);

  // 初始加载：并行请求对话列表和上次选中的对话
  const initialLoadDoneRef = useRef(false);
  useEffect(() => {
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;

    const initializeAgent = async () => {
      dispatch({ type: "SET_LOADING_CONVERSATIONS", payload: true });

      // 从 localStorage 获取保存的对话 ID
      let savedConversationId: string | null = null;
      try {
        savedConversationId = localStorage.getItem(getConversationStorageKey(projectId));
      } catch {}

      // 并行请求：对话列表 + 上次对话（如果有）
      const conversationsPromise = listConversations(projectId);
      const savedConversationPromise = savedConversationId
        ? getConversation(savedConversationId)
        : Promise.resolve(null);

      try {
        const [conversationsResult, savedConversationResult] = await Promise.all([
          conversationsPromise,
          savedConversationPromise,
        ]);

        // 处理对话列表
        if (conversationsResult.success && conversationsResult.conversations) {
          const newConversations = conversationsResult.conversations.map((conv) => ({
            id: conv.id,
            title: conv.title,
            status: conv.status as "active" | "awaiting_approval" | "completed",
            lastActivityAt: new Date(conv.lastActivityAt),
          }));
          dispatch({ type: "SET_CONVERSATIONS", payload: newConversations });

          // 处理上次选中的对话
          if (savedConversationId && savedConversationResult?.success && savedConversationResult.messages) {
            // 验证对话仍存在于列表中
            const exists = newConversations.some(c => c.id === savedConversationId);
            if (exists) {
              dispatch({ type: "LOAD_HISTORY", payload: savedConversationResult.messages });
              dispatch({ type: "SET_CURRENT_CONVERSATION", payload: savedConversationId });
              dispatch({ type: "SET_NEW_CONVERSATION", payload: false });
            } else {
              // 对话已删除
              localStorage.removeItem(getConversationStorageKey(projectId));
              dispatch({ type: "SET_NEW_CONVERSATION", payload: true });
            }
          } else {
            // 没有保存的对话或加载失败
            if (savedConversationId) {
              localStorage.removeItem(getConversationStorageKey(projectId));
            }
            dispatch({ type: "SET_NEW_CONVERSATION", payload: true });
          }
        } else {
          // 对话列表加载失败
          dispatch({ type: "SET_NEW_CONVERSATION", payload: true });
        }
      } catch (error) {
        console.error("[Agent] 初始加载失败:", error);
        dispatch({ type: "SET_NEW_CONVERSATION", payload: true });
      } finally {
        dispatch({ type: "SET_LOADING_CONVERSATIONS", payload: false });
        dispatch({ type: "SET_INITIAL_LOAD_COMPLETE", payload: true });
      }
    };

    initializeAgent();
  }, [projectId]);

  // 创建新对话（懒创建模式：只设置UI状态，不调用API）
  const createNewConversation = useCallback(() => {
    // 清空消息历史
    dispatch({ type: "CLEAR_MESSAGES" });
    // 设置为新对话模式
    dispatch({ type: "SET_NEW_CONVERSATION", payload: true });
    // 清空当前对话ID
    dispatch({ type: "SET_CURRENT_CONVERSATION", payload: null });
    // 重置自动模式
    dispatch({ type: "SET_AUTO_ACCEPT", payload: false });
    // 清除 localStorage
    try {
      localStorage.removeItem(getConversationStorageKey(projectId));
    } catch {}
  }, [projectId]);

  // 删除对话
  const deleteConversationById = useCallback(async (conversationId: string) => {
    try {
      const result = await deleteConversation(conversationId);
      if (result.success) {
        // 如果删除的是当前对话，回到新对话状态
        if (state.currentConversationId === conversationId) {
          dispatch({ type: "CLEAR_MESSAGES" });
          dispatch({ type: "SET_CURRENT_CONVERSATION", payload: null });
          dispatch({ type: "SET_NEW_CONVERSATION", payload: true });
          // 清除 localStorage
          try {
            localStorage.removeItem(getConversationStorageKey(projectId));
          } catch {}
        }
        // 静默刷新列表（用户已看到删除结果）
        await refreshConversations(true);
        toast.success("已删除对话");
      } else {
        toast.error(result.error || "删除对话失败");
      }
    } catch (error) {
      console.error("删除对话失败:", error);
      toast.error("删除对话失败");
    }
  }, [projectId, state.currentConversationId, refreshConversations]);

  // 便捷方法
  const addMessage = useCallback((message: Omit<AgentMessage, "timestamp" | "id"> & { id?: string }) => {
    const id = message.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: "SET_LOADING", payload: loading });
  }, []);

  const setAutoAccept = useCallback((enabled: boolean) => {
    dispatch({ type: "SET_AUTO_ACCEPT", payload: enabled });
  }, []);

  // 创建稳定的 currentContext（使用 useMemo 缓存，避免每次都创建新对象）
  const currentContext = useMemo((): AgentContextType => {
    // 将 Job 对象转换为序列化友好的格式（只保留 collectContext 需要的字段）
    const serializableJobs = editorContext.jobs.slice(0, 10).map(job => ({
      id: job.id,
      type: job.type,
      status: job.status,
      progressMessage: job.progressMessage,
    }));
    
    return {
      projectId,
      recentJobs: serializableJobs,
    };
  }, [
    projectId,
    editorContext.jobs,
  ]);

  // Context value（包含 state 以触发重新渲染）
  const value = useMemo(
    () => ({
      state, // 直接包含 state，让组件能响应变化
      dispatch,
      addMessage,
      updateMessage,
      clearMessages,
      setLoading,
      setAutoAccept,
      loadConversation,
      createNewConversation,
      deleteConversationById,
      refreshConversations,
      currentContext,
    }),
    [
      state, // 添加 state 依赖
      dispatch,
      addMessage,
      updateMessage,
      clearMessages,
      setLoading,
      setAutoAccept,
      loadConversation,
      createNewConversation,
      deleteConversationById,
      refreshConversations,
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
