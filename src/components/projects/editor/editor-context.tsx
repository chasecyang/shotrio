"use client";

import { createContext, useContext, useReducer, ReactNode, useMemo, useCallback, useEffect } from "react";
import { ProjectDetail, Episode } from "@/types/project";
import { useTaskPolling } from "@/hooks/use-task-polling";
import { useTaskRefresh } from "@/hooks/use-task-refresh";
import type { Job } from "@/types/job";
import { refreshProject } from "@/lib/actions/project/refresh";
import type { GenerationHistoryItem } from "@/types/asset";

// 选中资源类型
export type SelectedResourceType = "episode" | "video" | "asset-generation" | "asset" | "settings" | "agent" | null;

// 资源Tab类型
export type ResourceTabType = "episodes" | "assets" | "agent";

export interface SelectedResource {
  type: SelectedResourceType;
  id: string;
}

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
  
  // 当前选中的剧集
  selectedEpisodeId: string | null;
  
  // 当前激活的资源Tab
  activeResourceTab: ResourceTabType;
  
  // 当前选中的资源（用于右侧预览区）
  selectedResource: SelectedResource | null;
  
  // 加载状态
  isLoading: boolean;

  // 素材生成状态
  assetGeneration: AssetGenerationState;
}

// 编辑器动作类型
type EditorAction =
  | { type: "SET_PROJECT"; payload: ProjectDetail }
  | { type: "UPDATE_PROJECT"; payload: ProjectDetail } // 用于刷新项目数据（保持当前选中状态）
  | { type: "SELECT_EPISODE"; payload: string | null }
  | { type: "SET_ACTIVE_RESOURCE_TAB"; payload: ResourceTabType }
  | { type: "SELECT_RESOURCE"; payload: SelectedResource | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ASSET_GENERATION_MODE"; payload: "text-to-image" | "image-to-image" }
  | { type: "SET_SELECTED_SOURCE_ASSETS"; payload: string[] }
  | { type: "ADD_GENERATION_HISTORY"; payload: GenerationHistoryItem }
  | { type: "CLEAR_GENERATION_HISTORY" };

// 初始状态
const initialState: EditorState = {
  project: null,
  selectedEpisodeId: null,
  activeResourceTab: "episodes",
  selectedResource: null,
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
        selectedEpisodeId: action.payload.episodes[0]?.id || null,
        isLoading: false,
      };

    case "UPDATE_PROJECT":
      // 更新项目数据，但保持当前选中的剧集
      // 验证当前选中的剧集是否仍然存在于新项目中
      let validSelectedEpisodeId = state.selectedEpisodeId;
      if (state.selectedEpisodeId) {
        const episodeExists = action.payload.episodes.some(
          (ep) => ep.id === state.selectedEpisodeId
        );
        if (!episodeExists) {
          // 如果当前选中的剧集不存在，重置为第一个剧集或 null
          validSelectedEpisodeId = action.payload.episodes[0]?.id || null;
        }
      } else {
        // 如果没有选中剧集但项目有剧集，自动选择第一个
        validSelectedEpisodeId = action.payload.episodes[0]?.id || null;
      }
      
      return {
        ...state,
        project: action.payload,
        selectedEpisodeId: validSelectedEpisodeId,
        isLoading: false,
      };

    case "SELECT_EPISODE":
      return {
        ...state,
        selectedEpisodeId: action.payload,
        selectedResource: null,
      };

    case "SET_ACTIVE_RESOURCE_TAB":
      return {
        ...state,
        activeResourceTab: action.payload,
      };

    case "SELECT_RESOURCE":
      return {
        ...state,
        selectedResource: action.payload,
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
  selectEpisode: (episodeId: string | null) => void;
  setActiveResourceTab: (tab: ResourceTabType) => void;
  selectResource: (resource: SelectedResource | null) => void;
  updateProject: (project: ProjectDetail) => void; // 刷新项目数据
  setVideoFilter: (filter: Partial<VideoFilterState>) => void;
  // 计算属性
  selectedEpisode: Episode | null;
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
          selectedEpisodeId: initialProject.episodes[0]?.id || null,
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
      // 触发素材列表刷新事件，AssetPanel 会监听此事件
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
  const selectEpisode = useCallback((episodeId: string | null) => {
    dispatch({ type: "SELECT_EPISODE", payload: episodeId });
  }, []);

  const setActiveResourceTab = useCallback((tab: ResourceTabType) => {
    dispatch({ type: "SET_ACTIVE_RESOURCE_TAB", payload: tab });
  }, []);

  const selectResource = useCallback((resource: SelectedResource | null) => {
    dispatch({ type: "SELECT_RESOURCE", payload: resource });
  }, []);

  const updateProject = useCallback((project: ProjectDetail) => {
    dispatch({ type: "UPDATE_PROJECT", payload: project });
  }, []);

  const setVideoFilter = useCallback((filter: Partial<VideoFilterState>) => {
    dispatch({ type: "SET_VIDEO_FILTER", payload: filter });
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

  // 计算属性
  const selectedEpisode = useMemo(() => {
    if (!state.project || !state.selectedEpisodeId) return null;
    return state.project.episodes.find((ep) => ep.id === state.selectedEpisodeId) || null;
  }, [state.project, state.selectedEpisodeId]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      selectEpisode,
      setActiveResourceTab,
      selectResource,
      updateProject,
      setVideoFilter,
      setAssetGenerationMode,
      setSelectedSourceAssets,
      addGenerationHistory,
      clearGenerationHistory,
      selectedEpisode,
      jobs,
      refreshJobs,
    }),
    [
      state,
      selectEpisode,
      setActiveResourceTab,
      selectResource,
      updateProject,
      setVideoFilter,
      setAssetGenerationMode,
      setSelectedSourceAssets,
      addGenerationHistory,
      clearGenerationHistory,
      selectedEpisode,
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

