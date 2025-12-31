"use client";

import { createContext, useContext, useReducer, ReactNode, useMemo, useCallback, useEffect } from "react";
import { ProjectDetail } from "@/types/project";
import { useTaskPolling } from "@/hooks/use-task-polling";
import { useTaskRefresh } from "@/hooks/use-task-refresh";
import type { Job } from "@/types/job";
import { refreshProject } from "@/lib/actions/project/refresh";
import type { GenerationHistoryItem } from "@/types/asset";

// 素材生成状态
export interface AssetGenerationState {
  mode: "text-to-image" | "image-to-image";
  selectedSourceAssets: string[]; // 素材ID数组
  generationHistory: GenerationHistoryItem[];
}

// 编辑器状态
export interface EditorState {
  // 项目数据
  project: ProjectDetail | null;
  
  // 加载状态
  isLoading: boolean;

  // 素材生成状态
  assetGeneration: AssetGenerationState;
}

// 编辑器动作类型
type EditorAction =
  | { type: "SET_PROJECT"; payload: ProjectDetail }
  | { type: "UPDATE_PROJECT"; payload: ProjectDetail } // 用于刷新项目数据
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ASSET_GENERATION_MODE"; payload: "text-to-image" | "image-to-image" }
  | { type: "SET_SELECTED_SOURCE_ASSETS"; payload: string[] }
  | { type: "ADD_GENERATION_HISTORY"; payload: GenerationHistoryItem }
  | { type: "CLEAR_GENERATION_HISTORY" };

// 初始状态
const initialState: EditorState = {
  project: null,
  isLoading: true,
  assetGeneration: {
    mode: "text-to-image",
    selectedSourceAssets: [],
    generationHistory: [],
  },
};

// Reducer
function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_PROJECT":
      return {
        ...state,
        project: action.payload,
        isLoading: false,
      };

    case "UPDATE_PROJECT":
      return {
        ...state,
        project: action.payload,
        isLoading: false,
      };

    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };

    case "SET_ASSET_GENERATION_MODE":
      return {
        ...state,
        assetGeneration: {
          ...state.assetGeneration,
          mode: action.payload,
          // 切换到文生图模式时清空已选源素材
          selectedSourceAssets: action.payload === "text-to-image" ? [] : state.assetGeneration.selectedSourceAssets,
        },
      };

    case "SET_SELECTED_SOURCE_ASSETS":
      return {
        ...state,
        assetGeneration: {
          ...state.assetGeneration,
          selectedSourceAssets: action.payload,
        },
      };

    case "ADD_GENERATION_HISTORY":
      return {
        ...state,
        assetGeneration: {
          ...state.assetGeneration,
          generationHistory: [action.payload, ...state.assetGeneration.generationHistory].slice(0, 50), // 保留最近50条
        },
      };

    case "CLEAR_GENERATION_HISTORY":
      return {
        ...state,
        assetGeneration: {
          ...state.assetGeneration,
          generationHistory: [],
        },
      };

    default:
      return state;
  }
}

// Context 类型
interface EditorContextType {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  // 便捷方法
  updateProject: (project: ProjectDetail) => void; // 刷新项目数据
  // 任务轮询（单例）
  jobs: Job[];
  refreshJobs: () => void;
  // 素材生成相关方法
  setAssetGenerationMode: (mode: "text-to-image" | "image-to-image") => void;
  setSelectedSourceAssets: (assetIds: string[]) => void;
  addGenerationHistory: (history: GenerationHistoryItem) => void;
  clearGenerationHistory: () => void;
}

const EditorContext = createContext<EditorContextType | null>(null);

// Provider
interface EditorProviderProps {
  children: ReactNode;
  initialProject?: ProjectDetail;
}

export function EditorProvider({ children, initialProject }: EditorProviderProps) {
  const [state, dispatch] = useReducer(
    editorReducer,
    initialProject
      ? {
          ...initialState,
          project: initialProject,
          isLoading: false,
        }
      : initialState
  );

  // 单例任务轮询 - 整个编辑器只有一个轮询实例
  const { jobs, refresh: refreshJobs } = useTaskPolling();

  // 集成统一的任务刷新机制
  useTaskRefresh({
    jobs,
    onRefreshProject: useCallback(async (projectId: string) => {
      const updatedProject = await refreshProject(projectId);
      if (updatedProject) {
        dispatch({ type: "UPDATE_PROJECT", payload: updatedProject });
      }
    }, []),

    onRefreshAssets: useCallback(async () => {
      // 触发素材列表刷新事件，AssetGalleryPanel 会监听此事件
      window.dispatchEvent(new CustomEvent("asset-created"));
    }, []),
  });

  // 监听 project-changed 事件，用于 Agent 操作后刷新项目数据
  useEffect(() => {
    const handleProjectChanged = async () => {
      if (state.project) {
        try {
          const updatedProject = await refreshProject(state.project.id);
          if (updatedProject) {
            dispatch({ type: "UPDATE_PROJECT", payload: updatedProject });
          }
        } catch (error) {
          console.error("刷新项目失败:", error);
        }
      }
    };

    window.addEventListener("project-changed", handleProjectChanged);
    return () => window.removeEventListener("project-changed", handleProjectChanged);
  }, [state.project]);

  // 便捷方法
  const updateProject = useCallback((project: ProjectDetail) => {
    dispatch({ type: "UPDATE_PROJECT", payload: project });
  }, []);

  // 素材生成相关方法
  const setAssetGenerationMode = useCallback((mode: "text-to-image" | "image-to-image") => {
    dispatch({ type: "SET_ASSET_GENERATION_MODE", payload: mode });
  }, []);

  const setSelectedSourceAssets = useCallback((assetIds: string[]) => {
    dispatch({ type: "SET_SELECTED_SOURCE_ASSETS", payload: assetIds });
  }, []);

  const addGenerationHistory = useCallback((history: GenerationHistoryItem) => {
    dispatch({ type: "ADD_GENERATION_HISTORY", payload: history });
  }, []);

  const clearGenerationHistory = useCallback(() => {
    dispatch({ type: "CLEAR_GENERATION_HISTORY" });
  }, []);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      updateProject,
      setAssetGenerationMode,
      setSelectedSourceAssets,
      addGenerationHistory,
      clearGenerationHistory,
      jobs,
      refreshJobs,
    }),
    [
      state,
      updateProject,
      setAssetGenerationMode,
      setSelectedSourceAssets,
      addGenerationHistory,
      clearGenerationHistory,
      jobs,
      refreshJobs,
    ]
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

// Hook
export function useEditor() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditor must be used within an EditorProvider");
  }
  return context;
}

