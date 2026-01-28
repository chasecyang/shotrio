"use client";

import { createContext, useContext, useReducer, ReactNode, useMemo, useCallback, useEffect, useRef } from "react";
import { ProjectDetail } from "@/types/project";
import { useTaskPolling } from "@/hooks/use-task-polling";
import { useTaskRefresh } from "@/hooks/use-task-refresh";
import type { Job } from "@/types/job";
import { refreshProject } from "@/lib/actions/project/refresh";
import type { GenerationHistoryItem, AssetWithFullData, ImageResolution } from "@/types/asset";
import type { AspectRatio } from "@/lib/services/image.service";
import type { TimelineDetail } from "@/types/timeline";
import type { CutListItem } from "@/types/cut";
import { queryAssets } from "@/lib/actions/asset";
import type { CreditCost } from "@/lib/utils/credit-calculator";

// 编辑器模式
export type EditorMode = "asset-management" | "clipping";

// localStorage key
const getEditorModeStorageKey = (projectId: string) => `editor:project:${projectId}:mode`;

// 编辑参数预填充
export interface PrefillParams {
  prompt?: string;
  aspectRatio?: AspectRatio;
  resolution?: ImageResolution;
}

// 素材生成状态
export interface AssetGenerationState {
  mode: "text-to-image" | "image-to-image";
  selectedSourceAssets: string[]; // 素材ID数组
  generationHistory: GenerationHistoryItem[];
  // 编辑素材相关
  editingAsset: AssetWithFullData | null;
  prefillParams: PrefillParams | null;
}

// 播放状态
export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number; // 相对于整个时间轴的时间（毫秒）
  currentClipIndex: number; // 当前播放的片段索引
}

// 单个 function call 数据
export interface FunctionCallData {
  id: string;
  name: string;
  displayName?: string;
  arguments: Record<string, unknown>;
  category: string;
}

// 参数编辑数据
export interface ActionEditorData {
  // 单个模式（向后兼容）
  functionCall: FunctionCallData;
  // 批量模式（可选）
  functionCalls?: FunctionCallData[];
  creditCost?: CreditCost;
  currentBalance?: number;
  // 单个模式回调
  onConfirm: (id: string, modifiedParams?: Record<string, unknown>) => void;
  onCancel: (id: string) => void;
  // 批量模式回调（可选）
  onBatchConfirm?: (modifiedParamsMap: Map<string, Record<string, unknown>>, disabledIds?: Set<string>) => void;
}

// 编辑器状态
export interface EditorState {
  // 工作模式
  mode: EditorMode;

  // 当前编辑的 Cut ID（null 表示在素材库视图）
  activeCutId: string | null;

  // 项目数据
  project: ProjectDetail | null;

  // 时间轴数据（当前编辑的 Cut）
  timeline: TimelineDetail | null;

  // Cut 列表
  cuts: CutListItem[];
  cutsLoading: boolean;

  // 加载状态
  isLoading: boolean;

  // 素材列表状态
  assets: AssetWithFullData[];
  assetsLoading: boolean;
  assetsLoaded: boolean; // 标记是否已完成首次加载

  // 素材生成状态
  assetGeneration: AssetGenerationState;

  // 播放状态
  playback: PlaybackState;

  // 设置面板显示状态
  showSettings: boolean;

  // 参数编辑面板状态
  actionEditor?: ActionEditorData;
  previousView?: "gallery" | "clipping" | "settings"; // 保存切换前的视图

  // AI 编辑待处理素材（从素材卡片跳转到 Agent 时使用）
  pendingEditAsset: AssetWithFullData | null;
}

// 编辑器动作类型
type EditorAction =
  | { type: "SET_PROJECT"; payload: ProjectDetail }
  | { type: "UPDATE_PROJECT"; payload: ProjectDetail } // 用于刷新项目数据
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_MODE"; payload: EditorMode }
  | { type: "SET_ACTIVE_CUT"; payload: string | null } // 设置当前编辑的 Cut
  | { type: "SET_CUTS"; payload: CutListItem[] } // 设置 Cut 列表
  | { type: "SET_CUTS_LOADING"; payload: boolean }
  | { type: "SET_TIMELINE"; payload: TimelineDetail | null }
  | { type: "UPDATE_TIMELINE"; payload: TimelineDetail }
  | { type: "SET_ASSETS"; payload: AssetWithFullData[] }
  | { type: "SET_ASSETS_LOADING"; payload: boolean }
  | { type: "SET_ASSET_GENERATION_MODE"; payload: "text-to-image" | "image-to-image" }
  | { type: "SET_SELECTED_SOURCE_ASSETS"; payload: string[] }
  | { type: "ADD_GENERATION_HISTORY"; payload: GenerationHistoryItem }
  | { type: "CLEAR_GENERATION_HISTORY" }
  | { type: "SET_PLAYING"; payload: boolean }
  | { type: "SET_CURRENT_TIME"; payload: number }
  | { type: "SET_CURRENT_CLIP_INDEX"; payload: number }
  | { type: "UPDATE_PLAYBACK"; payload: Partial<PlaybackState> }
  | { type: "SET_SHOW_SETTINGS"; payload: boolean }
  | { type: "SET_ACTION_EDITOR"; payload: ActionEditorData }
  | { type: "CLEAR_ACTION_EDITOR" }
  | { type: "SET_EDITING_ASSET"; payload: { asset: AssetWithFullData | null; prefillParams?: PrefillParams } }
  | { type: "CLEAR_EDITING_ASSET" }
  | { type: "SET_PENDING_EDIT_ASSET"; payload: AssetWithFullData | null };

// 初始状态
const initialState: EditorState = {
  mode: "asset-management",
  activeCutId: null,
  project: null,
  timeline: null,
  cuts: [],
  cutsLoading: false,
  isLoading: true,
  assets: [],
  assetsLoading: false,
  assetsLoaded: false,
  assetGeneration: {
    mode: "text-to-image",
    selectedSourceAssets: [],
    generationHistory: [],
    editingAsset: null,
    prefillParams: null,
  },
  playback: {
    isPlaying: false,
    currentTime: 0,
    currentClipIndex: 0,
  },
  showSettings: false,
  pendingEditAsset: null,
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

    case "SET_MODE":
      return {
        ...state,
        mode: action.payload,
      };

    case "SET_ACTIVE_CUT":
      return {
        ...state,
        activeCutId: action.payload,
        // 切换 Cut 时清空 timeline，等待加载
        timeline: action.payload ? state.timeline : null,
        // 自动切换模式
        mode: action.payload ? "clipping" : "asset-management",
      };

    case "SET_CUTS":
      return {
        ...state,
        cuts: action.payload,
        cutsLoading: false,
      };

    case "SET_CUTS_LOADING":
      return {
        ...state,
        cutsLoading: action.payload,
      };

    case "SET_TIMELINE":
      return {
        ...state,
        timeline: action.payload,
      };

    case "UPDATE_TIMELINE":
      return {
        ...state,
        timeline: action.payload,
      };

    case "SET_ASSETS":
      return {
        ...state,
        assets: action.payload,
        assetsLoaded: true,
        assetsLoading: false,
      };

    case "SET_ASSETS_LOADING":
      return {
        ...state,
        assetsLoading: action.payload,
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

    case "SET_PLAYING":
      return {
        ...state,
        playback: {
          ...state.playback,
          isPlaying: action.payload,
        },
      };

    case "SET_CURRENT_TIME":
      return {
        ...state,
        playback: {
          ...state.playback,
          currentTime: action.payload,
        },
      };

    case "SET_CURRENT_CLIP_INDEX":
      return {
        ...state,
        playback: {
          ...state.playback,
          currentClipIndex: action.payload,
        },
      };

    case "UPDATE_PLAYBACK":
      return {
        ...state,
        playback: {
          ...state.playback,
          ...action.payload,
        },
      };

    case "SET_SHOW_SETTINGS":
      return {
        ...state,
        showSettings: action.payload,
      };

    case "SET_ACTION_EDITOR": {
      // 保存当前视图状态
      let previousView: "gallery" | "clipping" | "settings" = "gallery";
      if (state.mode === "clipping") {
        previousView = "clipping";
      } else if (state.showSettings) {
        previousView = "settings";
      }
      
      return {
        ...state,
        actionEditor: action.payload,
        previousView,
      };
    }

    case "CLEAR_ACTION_EDITOR": {
      // 恢复之前的视图状态
      const updates: Partial<EditorState> = {
        actionEditor: undefined,
        previousView: undefined,
      };

      if (state.previousView === "clipping") {
        updates.mode = "clipping";
      } else if (state.previousView === "settings") {
        updates.showSettings = true;
      } else {
        // 默认回到素材画廊
        updates.mode = "asset-management";
        updates.showSettings = false;
      }

      return {
        ...state,
        ...updates,
      };
    }

    case "SET_EDITING_ASSET":
      return {
        ...state,
        assetGeneration: {
          ...state.assetGeneration,
          editingAsset: action.payload.asset,
          prefillParams: action.payload.prefillParams || null,
          // 如果有 sourceAssetIds，设置为选中
          selectedSourceAssets: action.payload.asset?.sourceAssetIds || [],
          // 根据是否有 sourceAssetIds 自动切换模式
          mode: (action.payload.asset?.sourceAssetIds?.length ?? 0) > 0
            ? "image-to-image"
            : "text-to-image",
        },
      };

    case "CLEAR_EDITING_ASSET":
      return {
        ...state,
        assetGeneration: {
          ...state.assetGeneration,
          editingAsset: null,
          prefillParams: null,
        },
      };

    case "SET_PENDING_EDIT_ASSET":
      return {
        ...state,
        pendingEditAsset: action.payload,
      };

    default:
      return state;
  }
}

// 素材加载选项
export interface LoadAssetsOptions {
  search?: string;
  tags?: string[];
  showLoading?: boolean; // 是否显示加载状态（用于手动刷新）
}

// Context 类型
interface EditorContextType {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  // 便捷方法
  updateProject: (project: ProjectDetail) => void; // 刷新项目数据
  setMode: (mode: EditorMode) => void; // 切换编辑器模式
  setTimeline: (timeline: TimelineDetail | null) => void; // 设置时间轴数据
  updateTimeline: (timeline: TimelineDetail) => void; // 更新时间轴数据
  // Cut 相关方法
  setActiveCut: (cutId: string | null) => void; // 设置当前编辑的 Cut
  loadCuts: () => Promise<void>; // 加载 Cut 列表
  // 素材相关方法
  loadAssets: (options?: LoadAssetsOptions) => Promise<void>; // 加载素材列表
  // 任务轮询（单例）
  jobs: Job[];
  refreshJobs: () => void;
  // 素材生成相关方法
  setAssetGenerationMode: (mode: "text-to-image" | "image-to-image") => void;
  setSelectedSourceAssets: (assetIds: string[]) => void;
  addGenerationHistory: (history: GenerationHistoryItem) => void;
  clearGenerationHistory: () => void;
  // 设置面板相关方法
  setShowSettings: (show: boolean) => void;
  // 参数编辑面板相关方法
  setActionEditor: (data: ActionEditorData) => void;
  clearActionEditor: () => void;
  // 素材编辑相关方法
  setEditingAsset: (asset: AssetWithFullData | null, prefillParams?: PrefillParams) => void;
  clearEditingAsset: () => void;
  // AI 编辑相关方法
  setPendingEditAsset: (asset: AssetWithFullData | null) => void;
  // 素材引用相关方法
  referenceAssetInChat?: (asset: AssetWithFullData, presetText?: string) => void;
  registerReferenceCallback?: (callback: (asset: AssetWithFullData, presetText?: string) => void) => void;
  unregisterReferenceCallback?: () => void;
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
      // 直接刷新素材列表
      if (loadAssetsRef.current) {
        await loadAssetsRef.current();
      }
      // 同时触发事件以兼容其他监听器
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

  // 从 localStorage 恢复编辑器模式
  const modeRestoredRef = useRef(false);
  useEffect(() => {
    if (!initialProject?.id || modeRestoredRef.current) return;
    modeRestoredRef.current = true;
    try {
      const saved = localStorage.getItem(getEditorModeStorageKey(initialProject.id));
      if (saved === "asset-management" || saved === "clipping") {
        dispatch({ type: "SET_MODE", payload: saved });
      }
    } catch {}
  }, [initialProject?.id]);

  // 便捷方法
  const updateProject = useCallback((project: ProjectDetail) => {
    dispatch({ type: "UPDATE_PROJECT", payload: project });
  }, []);

  const setMode = useCallback((mode: EditorMode) => {
    dispatch({ type: "SET_MODE", payload: mode });
    // 保存到 localStorage
    if (state.project?.id) {
      try {
        localStorage.setItem(getEditorModeStorageKey(state.project.id), mode);
      } catch {}
    }
  }, [state.project?.id]);

  const setTimeline = useCallback((timeline: TimelineDetail | null) => {
    dispatch({ type: "SET_TIMELINE", payload: timeline });
  }, []);

  const updateTimeline = useCallback((timeline: TimelineDetail) => {
    dispatch({ type: "UPDATE_TIMELINE", payload: timeline });
  }, []);

  // Cut 相关方法
  const setActiveCut = useCallback((cutId: string | null) => {
    dispatch({ type: "SET_ACTIVE_CUT", payload: cutId });
  }, []);

  const loadCuts = useCallback(async () => {
    if (!state.project?.id) return;
    dispatch({ type: "SET_CUTS_LOADING", payload: true });
    try {
      const { getProjectCuts } = await import("@/lib/actions/cut");
      const cuts = await getProjectCuts(state.project.id);
      dispatch({ type: "SET_CUTS", payload: cuts });
    } catch (error) {
      console.error("加载 Cut 列表失败:", error);
      dispatch({ type: "SET_CUTS_LOADING", payload: false });
    }
  }, [state.project?.id]);

  // 用于防止重复加载的 ref
  const isLoadingAssetsRef = useRef(false);

  // 用于在 useTaskRefresh 中调用 loadAssets 的 ref
  const loadAssetsRef = useRef<((options?: LoadAssetsOptions) => Promise<void>) | null>(null);

  // 用于存储素材引用回调的 ref
  const referenceAssetCallbackRef = useRef<((asset: AssetWithFullData, presetText?: string) => void) | null>(null);

  // 加载素材列表
  const loadAssets = useCallback(async (options?: LoadAssetsOptions) => {
    if (!state.project?.id) return;
    if (isLoadingAssetsRef.current) return;

    // 首次加载或手动刷新时显示 loading
    if (!state.assetsLoaded || options?.showLoading) {
      dispatch({ type: "SET_ASSETS_LOADING", payload: true });
    }

    isLoadingAssetsRef.current = true;
    try {
      const result = await queryAssets({
        projectId: state.project.id,
        limit: 200,
        search: options?.search,
        tagFilters: options?.tags && options.tags.length > 0 ? options.tags : undefined,
      });
      dispatch({ type: "SET_ASSETS", payload: result.assets });
    } catch (error) {
      console.error("加载素材失败:", error);
      dispatch({ type: "SET_ASSETS_LOADING", payload: false });
    } finally {
      isLoadingAssetsRef.current = false;
    }
  }, [state.project?.id, state.assetsLoaded]);

  // 将 loadAssets 存储到 ref 中，供 useTaskRefresh 使用
  useEffect(() => {
    loadAssetsRef.current = loadAssets;
  }, [loadAssets]);

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

  const setShowSettings = useCallback((show: boolean) => {
    dispatch({ type: "SET_SHOW_SETTINGS", payload: show });
  }, []);

  const setActionEditor = useCallback((data: ActionEditorData) => {
    dispatch({ type: "SET_ACTION_EDITOR", payload: data });
  }, []);

  const clearActionEditor = useCallback(() => {
    dispatch({ type: "CLEAR_ACTION_EDITOR" });
  }, []);

  const setEditingAsset = useCallback((asset: AssetWithFullData | null, prefillParams?: PrefillParams) => {
    dispatch({ type: "SET_EDITING_ASSET", payload: { asset, prefillParams } });
  }, []);

  const clearEditingAsset = useCallback(() => {
    dispatch({ type: "CLEAR_EDITING_ASSET" });
  }, []);

  const setPendingEditAsset = useCallback((asset: AssetWithFullData | null) => {
    dispatch({ type: "SET_PENDING_EDIT_ASSET", payload: asset });
  }, []);

  // 引用素材到对话框
  const referenceAssetInChat = useCallback((asset: AssetWithFullData, presetText?: string) => {
    if (referenceAssetCallbackRef.current) {
      referenceAssetCallbackRef.current(asset, presetText);
    }
  }, []);

  // 注册引用回调
  const registerReferenceCallback = useCallback((callback: (asset: AssetWithFullData, presetText?: string) => void) => {
    referenceAssetCallbackRef.current = callback;
  }, []);

  // 注销引用回调
  const unregisterReferenceCallback = useCallback(() => {
    referenceAssetCallbackRef.current = null;
  }, []);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      updateProject,
      setMode,
      setTimeline,
      updateTimeline,
      setActiveCut,
      loadCuts,
      loadAssets,
      setAssetGenerationMode,
      setSelectedSourceAssets,
      addGenerationHistory,
      clearGenerationHistory,
      setShowSettings,
      setActionEditor,
      clearActionEditor,
      setEditingAsset,
      clearEditingAsset,
      setPendingEditAsset,
      referenceAssetInChat,
      registerReferenceCallback,
      unregisterReferenceCallback,
      jobs,
      refreshJobs,
    }),
    [
      state,
      updateProject,
      setMode,
      setTimeline,
      updateTimeline,
      setActiveCut,
      loadCuts,
      loadAssets,
      setAssetGenerationMode,
      setSelectedSourceAssets,
      addGenerationHistory,
      clearGenerationHistory,
      setShowSettings,
      setActionEditor,
      clearActionEditor,
      setEditingAsset,
      clearEditingAsset,
      setPendingEditAsset,
      referenceAssetInChat,
      registerReferenceCallback,
      unregisterReferenceCallback,
      jobs,
      refreshJobs,
    ]
  );

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

// Hook
export function useEditor() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditor must be used within an EditorProvider");
  }
  return context;
}

