"use client";

import { createContext, useContext, useReducer, ReactNode, useMemo, useCallback } from "react";
import { ProjectDetail, ShotDetail, Episode, Character, CharacterImage, Scene } from "@/types/project";
import { useTaskPolling } from "@/hooks/use-task-polling";
import { useTaskRefresh } from "@/hooks/use-task-refresh";
import type { Job } from "@/types/job";
import {
  refreshShot,
  refreshCharacter,
  refreshScene,
  refreshEpisodeShots,
  refreshProject,
} from "@/lib/actions/project/refresh";

// 选中资源类型
export type SelectedResourceType = "episode" | "shot" | "character" | "scene" | null;

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
  
  // 分镜提取对话框状态
  storyboardExtractionDialog: {
    open: boolean;
    episodeId: string | null;
    jobId: string | null;
  };

  // 分镜拆解对话框状态
  shotDecompositionDialog: {
    open: boolean;
    shotId: string | null;
    jobId: string | null;
  };
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
  | { type: "OPEN_STORYBOARD_EXTRACTION_DIALOG"; payload: { episodeId: string; jobId: string } }
  | { type: "CLOSE_STORYBOARD_EXTRACTION_DIALOG" }
  | { type: "OPEN_SHOT_DECOMPOSITION_DIALOG"; payload: { shotId: string; jobId: string } }
  | { type: "CLOSE_SHOT_DECOMPOSITION_DIALOG" }
  | { type: "START_PLAYBACK" }
  | { type: "STOP_PLAYBACK" }
  | { type: "SET_PLAYBACK_SHOT_INDEX"; payload: number }
  | { type: "TOGGLE_PLAYBACK_PAUSE" };

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
  storyboardExtractionDialog: {
    open: false,
    episodeId: null,
    jobId: null,
  },
  shotDecompositionDialog: {
    open: false,
    shotId: null,
    jobId: null,
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
      return {
        ...state,
        project: action.payload,
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

    case "OPEN_STORYBOARD_EXTRACTION_DIALOG":
      return {
        ...state,
        storyboardExtractionDialog: {
          open: true,
          episodeId: action.payload.episodeId,
          jobId: action.payload.jobId,
        },
        // 同时切换到对应的剧集
        selectedEpisodeId: action.payload.episodeId,
        selectedResource: { type: "episode", id: action.payload.episodeId },
        // 退出播放模式
        playbackState: {
          isPlaybackMode: false,
          currentShotIndex: 0,
          isPaused: false,
        },
      };

    case "CLOSE_STORYBOARD_EXTRACTION_DIALOG":
      return {
        ...state,
        storyboardExtractionDialog: {
          open: false,
          episodeId: null,
          jobId: null,
        },
      };

    case "OPEN_SHOT_DECOMPOSITION_DIALOG":
      return {
        ...state,
        shotDecompositionDialog: {
          open: true,
          shotId: action.payload.shotId,
          jobId: action.payload.jobId,
        },
      };

    case "CLOSE_SHOT_DECOMPOSITION_DIALOG":
      return {
        ...state,
        shotDecompositionDialog: {
          open: false,
          shotId: null,
          jobId: null,
        },
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
  openStoryboardExtractionDialog: (episodeId: string, jobId: string) => void;
  closeStoryboardExtractionDialog: () => void;
  openShotDecompositionDialog: (shotId: string, jobId: string) => void;
  closeShotDecompositionDialog: () => void;
  // 播放控制方法
  startPlayback: () => void;
  stopPlayback: () => void;
  nextShot: () => void;
  previousShot: () => void;
  togglePlaybackPause: () => void;
  // 计算属性
  selectedEpisode: Episode | null;
  selectedShot: ShotDetail | null;
  selectedCharacter: (Character & { images: CharacterImage[] }) | null;
  selectedScene: Scene | null;
  totalDuration: number;
  // 任务轮询（单例）
  jobs: Job[];
  refreshJobs: () => void;
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

    onRefreshCharacter: useCallback(async (characterId: string, projectId: string) => {
      // 刷新整个项目以更新角色数据
      const updatedProject = await refreshProject(projectId);
      if (updatedProject) {
        dispatch({ type: "UPDATE_PROJECT", payload: updatedProject });
      }
    }, []),

    onRefreshScene: useCallback(async (sceneId: string, projectId: string) => {
      // 刷新整个项目以更新场景数据
      const updatedProject = await refreshProject(projectId);
      if (updatedProject) {
        dispatch({ type: "UPDATE_PROJECT", payload: updatedProject });
      }
    }, []),

    onRefreshEpisode: useCallback(async (episodeId: string) => {
      const result = await refreshEpisodeShots(episodeId);
      if (result.success && result.shots) {
        // 只有当该剧集是当前选中的剧集时才更新 shots
        if (state.selectedEpisodeId === episodeId) {
          dispatch({ type: "SET_SHOTS", payload: result.shots });
        }
      }
    }, [state.selectedEpisodeId]),

    onRefreshProject: useCallback(async (projectId: string) => {
      const updatedProject = await refreshProject(projectId);
      if (updatedProject) {
        dispatch({ type: "UPDATE_PROJECT", payload: updatedProject });
      }
    }, []),
  });

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

  const openStoryboardExtractionDialog = useCallback((episodeId: string, jobId: string) => {
    dispatch({ type: "OPEN_STORYBOARD_EXTRACTION_DIALOG", payload: { episodeId, jobId } });
  }, []);

  const closeStoryboardExtractionDialog = useCallback(() => {
    dispatch({ type: "CLOSE_STORYBOARD_EXTRACTION_DIALOG" });
  }, []);

  const openShotDecompositionDialog = useCallback((shotId: string, jobId: string) => {
    dispatch({ type: "OPEN_SHOT_DECOMPOSITION_DIALOG", payload: { shotId, jobId } });
  }, []);

  const closeShotDecompositionDialog = useCallback(() => {
    dispatch({ type: "CLOSE_SHOT_DECOMPOSITION_DIALOG" });
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

  // 计算属性
  const selectedEpisode = useMemo(() => {
    if (!state.project || !state.selectedEpisodeId) return null;
    return state.project.episodes.find((ep) => ep.id === state.selectedEpisodeId) || null;
  }, [state.project, state.selectedEpisodeId]);

  const selectedShot = useMemo(() => {
    if (state.selectedResource?.type !== "shot") return null;
    return state.shots.find((shot) => shot.id === state.selectedResource?.id) || null;
  }, [state.selectedResource, state.shots]);

  const selectedCharacter = useMemo(() => {
    if (state.selectedResource?.type !== "character" || !state.project) return null;
    return state.project.characters.find((c) => c.id === state.selectedResource?.id) || null;
  }, [state.selectedResource, state.project]);

  const selectedScene = useMemo(() => {
    if (state.selectedResource?.type !== "scene" || !state.project?.scenes) return null;
    return state.project.scenes.find((s) => s.id === state.selectedResource?.id) || null;
  }, [state.selectedResource, state.project]);

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
      openStoryboardExtractionDialog,
      closeStoryboardExtractionDialog,
      openShotDecompositionDialog,
      closeShotDecompositionDialog,
      startPlayback,
      stopPlayback,
      nextShot,
      previousShot,
      togglePlaybackPause,
      selectedEpisode,
      selectedShot,
      selectedCharacter,
      selectedScene,
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
      openStoryboardExtractionDialog,
      closeStoryboardExtractionDialog,
      openShotDecompositionDialog,
      closeShotDecompositionDialog,
      startPlayback,
      stopPlayback,
      nextShot,
      previousShot,
      togglePlaybackPause,
      selectedEpisode,
      selectedShot,
      selectedCharacter,
      selectedScene,
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

