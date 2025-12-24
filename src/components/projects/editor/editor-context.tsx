"use client";

import { createContext, useContext, useReducer, ReactNode, useMemo, useCallback, useEffect } from "react";
import { ProjectDetail, ShotDetail, Episode } from "@/types/project";
import { useTaskPolling } from "@/hooks/use-task-polling";
import { useTaskRefresh } from "@/hooks/use-task-refresh";
import type { Job } from "@/types/job";
import {
  refreshShot,
  refreshEpisodeShots,
  refreshProject,
} from "@/lib/actions/project/refresh";
import type { GenerationHistoryItem } from "@/types/asset";

// 选中资源类型
export type SelectedResourceType = "episode" | "shot" | "asset-generation" | "asset" | "settings" | "agent" | null;

export interface SelectedResource {
  type: SelectedResourceType;
  id: string;
}

// 时间轴状态
export interface TimelineState {
  zoom: number; // 缩放级别 (0.5 - 3)
  playhead: number; // 播放头位置（毫秒）
  isPlaying: boolean; // 是否播放中
  scrollPosition: number; // 水平滚动位置
}

// 播放器状态
export interface PlaybackState {
  isPlaybackMode: boolean; // 是否处于播放模式
  currentShotIndex: number; // 当前播放的分镜索引
  isPaused: boolean; // 是否暂停
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
  
  // 当前选中的剧集（用于时间轴展示）
  selectedEpisodeId: string | null;
  
  // 当前选中的资源（用于右侧预览区）
  selectedResource: SelectedResource | null;
  
  // 时间轴状态
  timeline: TimelineState;
  
  // 播放器状态
  playbackState: PlaybackState;
  
  // 当前剧集的分镜列表
  shots: ShotDetail[];
  
  // 多选分镜（用于批量操作）
  selectedShotIds: string[];
  
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
  | { type: "SELECT_RESOURCE"; payload: SelectedResource | null }
  | { type: "SET_SHOTS"; payload: ShotDetail[] }
  | { type: "UPDATE_SHOT"; payload: ShotDetail } // 更新单个分镜
  | { type: "SELECT_SHOT"; payload: string }
  | { type: "SELECT_SHOTS"; payload: string[] }
  | { type: "TOGGLE_SHOT_SELECTION"; payload: string }
  | { type: "CLEAR_SHOT_SELECTION" }
  | { type: "SET_TIMELINE_ZOOM"; payload: number }
  | { type: "SET_PLAYHEAD"; payload: number }
  | { type: "SET_PLAYING"; payload: boolean }
  | { type: "SET_SCROLL_POSITION"; payload: number }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "START_PLAYBACK" }
  | { type: "STOP_PLAYBACK" }
  | { type: "SET_PLAYBACK_SHOT_INDEX"; payload: number }
  | { type: "TOGGLE_PLAYBACK_PAUSE" }
  | { type: "SET_ASSET_GENERATION_MODE"; payload: "text-to-image" | "image-to-image" }
  | { type: "SET_SELECTED_SOURCE_ASSETS"; payload: string[] }
  | { type: "ADD_GENERATION_HISTORY"; payload: GenerationHistoryItem }
  | { type: "CLEAR_GENERATION_HISTORY" };

// 初始状态
const initialState: EditorState = {
  project: null,
  selectedEpisodeId: null,
  selectedResource: null,
  timeline: {
    zoom: 1,
    playhead: 0,
    isPlaying: false,
    scrollPosition: 0,
  },
  playbackState: {
    isPlaybackMode: false,
    currentShotIndex: 0,
    isPaused: false,
  },
  shots: [],
  selectedShotIds: [],
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
        selectedShotIds: [],
        shots: [],
        // 退出播放模式
        playbackState: {
          isPlaybackMode: false,
          currentShotIndex: 0,
          isPaused: false,
        },
      };

    case "SELECT_RESOURCE":
      return {
        ...state,
        selectedResource: action.payload,
        // 退出播放模式
        playbackState: {
          isPlaybackMode: false,
          currentShotIndex: 0,
          isPaused: false,
        },
      };

    case "SET_SHOTS":
      return {
        ...state,
        shots: action.payload,
      };

    case "UPDATE_SHOT":
      return {
        ...state,
        shots: state.shots.map((shot) =>
          shot.id === action.payload.id ? action.payload : shot
        ),
      };

    case "SELECT_SHOT":
      return {
        ...state,
        selectedShotIds: [action.payload],
        selectedResource: { type: "shot", id: action.payload },
        // 退出播放模式
        playbackState: {
          isPlaybackMode: false,
          currentShotIndex: 0,
          isPaused: false,
        },
      };

    case "SELECT_SHOTS":
      return {
        ...state,
        selectedShotIds: action.payload,
        selectedResource: action.payload.length === 1 
          ? { type: "shot", id: action.payload[0] }
          : action.payload.length > 1
          ? { type: "shot", id: action.payload[0] } // 多选时显示第一个
          : null,
        // 退出播放模式
        playbackState: {
          isPlaybackMode: false,
          currentShotIndex: 0,
          isPaused: false,
        },
      };

    case "TOGGLE_SHOT_SELECTION":
      const isSelected = state.selectedShotIds.includes(action.payload);
      const newSelection = isSelected
        ? state.selectedShotIds.filter((id) => id !== action.payload)
        : [...state.selectedShotIds, action.payload];
      return {
        ...state,
        selectedShotIds: newSelection,
        selectedResource: newSelection.length > 0
          ? { type: "shot", id: newSelection[newSelection.length - 1] }
          : state.selectedResource,
        // 退出播放模式
        playbackState: {
          isPlaybackMode: false,
          currentShotIndex: 0,
          isPaused: false,
        },
      };

    case "CLEAR_SHOT_SELECTION":
      return {
        ...state,
        selectedShotIds: [],
      };

    case "SET_TIMELINE_ZOOM":
      return {
        ...state,
        timeline: { ...state.timeline, zoom: Math.max(0.5, Math.min(3, action.payload)) },
      };

    case "SET_PLAYHEAD":
      return {
        ...state,
        timeline: { ...state.timeline, playhead: Math.max(0, action.payload) },
      };

    case "SET_PLAYING":
      return {
        ...state,
        timeline: { ...state.timeline, isPlaying: action.payload },
      };

    case "SET_SCROLL_POSITION":
      return {
        ...state,
        timeline: { ...state.timeline, scrollPosition: action.payload },
      };

    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };

    case "START_PLAYBACK":
      return {
        ...state,
        playbackState: {
          isPlaybackMode: true,
          currentShotIndex: 0,
          isPaused: false,
        },
      };

    case "STOP_PLAYBACK":
      return {
        ...state,
        playbackState: {
          isPlaybackMode: false,
          currentShotIndex: 0,
          isPaused: false,
        },
      };

    case "SET_PLAYBACK_SHOT_INDEX":
      return {
        ...state,
        playbackState: {
          ...state.playbackState,
          currentShotIndex: action.payload,
        },
      };

    case "TOGGLE_PLAYBACK_PAUSE":
      return {
        ...state,
        playbackState: {
          ...state.playbackState,
          isPaused: !state.playbackState.isPaused,
        },
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
  selectResource: (resource: SelectedResource | null) => void;
  selectShot: (shotId: string) => void;
  selectShots: (shotIds: string[]) => void;
  toggleShotSelection: (shotId: string) => void;
  clearShotSelection: () => void;
  updateShot: (shot: ShotDetail) => void; // 更新单个分镜
  setTimelineZoom: (zoom: number) => void;
  setPlayhead: (position: number) => void;
  setPlaying: (playing: boolean) => void;
  updateProject: (project: ProjectDetail) => void; // 刷新项目数据
  // 播放控制方法
  startPlayback: () => void;
  stopPlayback: () => void;
  nextShot: () => void;
  previousShot: () => void;
  togglePlaybackPause: () => void;
  // 计算属性
  selectedEpisode: Episode | null;
  selectedShot: ShotDetail | null;
  totalDuration: number;
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
    onRefreshShot: useCallback(async (shotId: string) => {
      const result = await refreshShot(shotId);
      if (result.success && result.shot) {
        // 更新 shots 列表中的对应 shot
        dispatch({ type: "UPDATE_SHOT", payload: result.shot });
      }
    }, []),

    // onRefreshCharacter 和 onRefreshScene 已废弃 - 使用 asset 系统代替

    onRefreshEpisode: useCallback(async (episodeId: string) => {
      try {
        const result = await refreshEpisodeShots(episodeId);
        if (result.success && result.shots) {
          // 只有当该剧集是当前选中的剧集时才更新 shots
          if (state.selectedEpisodeId === episodeId) {
            dispatch({ type: "SET_SHOTS", payload: result.shots });
          }
        } else {
          // 刷新失败时不更新分镜列表（保持现有数据），只记录错误日志
          console.error("刷新剧集分镜失败:", result.error);
        }
      } catch (error) {
        // 刷新失败时不更新分镜列表（保持现有数据），只记录错误日志
        console.error("刷新剧集分镜失败:", error);
      }
    }, [state.selectedEpisodeId]),

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

  // 监听 shots-changed 事件，用于 Agent 分镜操作后刷新时间轴
  useEffect(() => {
    const handleShotsChanged = async () => {
      if (state.selectedEpisodeId) {
        try {
          const result = await refreshEpisodeShots(state.selectedEpisodeId);
          if (result.success && result.shots) {
            // 只在成功时才更新分镜列表
            dispatch({ type: "SET_SHOTS", payload: result.shots });
          } else {
            // 刷新失败时保留之前的分镜数据，只记录错误日志
            console.error("刷新分镜失败:", result.error);
          }
        } catch (error) {
          // 刷新失败时保留之前的分镜数据，只记录错误日志
          console.error("刷新分镜失败:", error);
        }
      }
    };

    window.addEventListener("shots-changed", handleShotsChanged);
    return () => window.removeEventListener("shots-changed", handleShotsChanged);
  }, [state.selectedEpisodeId]);

  // 便捷方法
  const selectEpisode = useCallback((episodeId: string | null) => {
    dispatch({ type: "SELECT_EPISODE", payload: episodeId });
  }, []);

  const selectResource = useCallback((resource: SelectedResource | null) => {
    dispatch({ type: "SELECT_RESOURCE", payload: resource });
  }, []);

  const selectShot = useCallback((shotId: string) => {
    dispatch({ type: "SELECT_SHOT", payload: shotId });
  }, []);

  const selectShots = useCallback((shotIds: string[]) => {
    dispatch({ type: "SELECT_SHOTS", payload: shotIds });
  }, []);

  const toggleShotSelection = useCallback((shotId: string) => {
    dispatch({ type: "TOGGLE_SHOT_SELECTION", payload: shotId });
  }, []);

  const clearShotSelection = useCallback(() => {
    dispatch({ type: "CLEAR_SHOT_SELECTION" });
  }, []);

  const updateShot = useCallback((shot: ShotDetail) => {
    dispatch({ type: "UPDATE_SHOT", payload: shot });
  }, []);

  const setTimelineZoom = useCallback((zoom: number) => {
    dispatch({ type: "SET_TIMELINE_ZOOM", payload: zoom });
  }, []);

  const setPlayhead = useCallback((position: number) => {
    dispatch({ type: "SET_PLAYHEAD", payload: position });
  }, []);

  const setPlaying = useCallback((playing: boolean) => {
    dispatch({ type: "SET_PLAYING", payload: playing });
  }, []);

  const updateProject = useCallback((project: ProjectDetail) => {
    dispatch({ type: "UPDATE_PROJECT", payload: project });
  }, []);

  // 播放控制方法
  const startPlayback = useCallback(() => {
    dispatch({ type: "START_PLAYBACK" });
  }, []);

  const stopPlayback = useCallback(() => {
    dispatch({ type: "STOP_PLAYBACK" });
  }, []);

  const nextShot = useCallback(() => {
    const currentIndex = state.playbackState.currentShotIndex;
    if (currentIndex < state.shots.length - 1) {
      dispatch({ type: "SET_PLAYBACK_SHOT_INDEX", payload: currentIndex + 1 });
    } else {
      // 最后一个分镜，退出播放模式
      dispatch({ type: "STOP_PLAYBACK" });
    }
  }, [state.playbackState.currentShotIndex, state.shots.length]);

  const previousShot = useCallback(() => {
    const currentIndex = state.playbackState.currentShotIndex;
    if (currentIndex > 0) {
      dispatch({ type: "SET_PLAYBACK_SHOT_INDEX", payload: currentIndex - 1 });
    }
  }, [state.playbackState.currentShotIndex]);

  const togglePlaybackPause = useCallback(() => {
    dispatch({ type: "TOGGLE_PLAYBACK_PAUSE" });
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

  const selectedShot = useMemo(() => {
    if (state.selectedResource?.type !== "shot") return null;
    return state.shots.find((shot) => shot.id === state.selectedResource?.id) || null;
  }, [state.selectedResource, state.shots]);


  const totalDuration = useMemo(() => {
    return state.shots.reduce((total, shot) => total + (shot.duration || 3000), 0);
  }, [state.shots]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      selectEpisode,
      selectResource,
      selectShot,
      selectShots,
      toggleShotSelection,
      clearShotSelection,
      updateShot,
      setTimelineZoom,
      setPlayhead,
      setPlaying,
      updateProject,
      startPlayback,
      stopPlayback,
      nextShot,
      previousShot,
      togglePlaybackPause,
      setAssetGenerationMode,
      setSelectedSourceAssets,
      addGenerationHistory,
      clearGenerationHistory,
      selectedEpisode,
      selectedShot,
      totalDuration,
      jobs,
      refreshJobs,
    }),
    [
      state,
      selectEpisode,
      selectResource,
      selectShot,
      selectShots,
      toggleShotSelection,
      clearShotSelection,
      updateShot,
      setTimelineZoom,
      setPlayhead,
      setPlaying,
      updateProject,
      startPlayback,
      stopPlayback,
      nextShot,
      previousShot,
      togglePlaybackPause,
      setAssetGenerationMode,
      setSelectedSourceAssets,
      addGenerationHistory,
      clearGenerationHistory,
      selectedEpisode,
      selectedShot,
      totalDuration,
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

