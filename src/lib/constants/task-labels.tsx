import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Ban,
  Users,
  Sparkles,
  Film,
  Images,
  Video,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { JobType, JobStatus } from "@/types/job";

/**
 * 任务类型标签配置
 */
export interface TaskTypeConfig {
  label: string;
  iconName: string; // 改用图标名称，而不是 React 节点
}

export const TASK_TYPE_LABELS: Record<JobType, TaskTypeConfig> = {
  character_extraction: {
    label: "角色提取",
    iconName: "Users",
  },
  scene_extraction: {
    label: "场景提取",
    iconName: "Film",
  },
  character_image_generation: {
    label: "角色造型生成",
    iconName: "Sparkles",
  },
  scene_image_generation: {
    label: "场景图生成",
    iconName: "Sparkles",
  },
  storyboard_generation: {
    label: "分镜提取",
    iconName: "Film",
  },
  storyboard_basic_extraction: {
    label: "基础分镜提取",
    iconName: "Film",
  },
  storyboard_matching: {
    label: "角色场景匹配",
    iconName: "Users",
  },
  shot_decomposition: {
    label: "分镜拆解",
    iconName: "Film",
  },
  batch_image_generation: {
    label: "批量图像生成",
    iconName: "Images",
  },
  shot_image_generation: {
    label: "分镜图生成",
    iconName: "Images",
  },
  batch_shot_image_generation: {
    label: "批量分镜图生成",
    iconName: "Images",
  },
  asset_image_generation: {
    label: "素材图片生成",
    iconName: "Sparkles",
  },
  video_generation: {
    label: "视频生成",
    iconName: "Video",
  },
  shot_video_generation: {
    label: "单镜视频生成",
    iconName: "Video",
  },
  batch_video_generation: {
    label: "批量视频生成",
    iconName: "Video",
  },
  shot_tts_generation: {
    label: "语音合成",
    iconName: "Sparkles",
  },
  final_video_export: {
    label: "最终成片导出",
    iconName: "Film",
  },
};

/**
 * 任务状态配置
 */
export interface TaskStatusConfig {
  label: string;
  iconName: string;
  color: string;
}

export const TASK_STATUS_CONFIG: Record<JobStatus, TaskStatusConfig> = {
  pending: {
    label: "等待中",
    iconName: "Clock",
    color: "text-yellow-600 dark:text-yellow-400",
  },
  processing: {
    label: "处理中",
    iconName: "Loader2",
    color: "text-blue-600 dark:text-blue-400",
  },
  completed: {
    label: "已完成",
    iconName: "CheckCircle2",
    color: "text-green-600 dark:text-green-400",
  },
  failed: {
    label: "失败",
    iconName: "XCircle",
    color: "text-red-600 dark:text-red-400",
  },
  cancelled: {
    label: "已取消",
    iconName: "Ban",
    color: "text-gray-600 dark:text-gray-400",
  },
};

/**
 * 支持"查看结果"的任务类型列表
 */
export const VIEWABLE_TASK_TYPES: JobType[] = [
  "storyboard_generation",
  "character_extraction",
  "scene_extraction",
  "shot_decomposition",
];

/**
 * 图标映射表
 */
const iconMap = {
  Users,
  Sparkles,
  Film,
  Images,
  Video,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
};

/**
 * 根据图标名称和大小获取图标组件
 */
export function getTaskIcon(iconName: string, size: "sm" | "md" = "md") {
  const IconComponent = iconMap[iconName as keyof typeof iconMap];
  if (!IconComponent) return null;

  const sizeClass = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const shouldAnimate = iconName === "Loader2";

  return (
    <IconComponent
      className={`${sizeClass}${shouldAnimate ? " animate-spin" : ""}`}
    />
  );
}

/**
 * 获取任务类型标签（仅文本，用于服务端）
 */
export function getTaskTypeLabelText(type: JobType | string): string {
  const config = TASK_TYPE_LABELS[type as JobType];
  return config?.label || "未知任务";
}

/**
 * 获取任务类型标签和图标（用于客户端）
 */
export function getTaskTypeLabel(
  type: JobType | string,
  size: "sm" | "md" = "md"
): { label: string; icon: React.ReactNode } {
  const label = getTaskTypeLabelText(type);
  const config = TASK_TYPE_LABELS[type as JobType];

  return {
    label,
    icon: config ? getTaskIcon(config.iconName, size) : null,
  };
}

/**
 * 获取任务状态标签和图标
 */
export function getTaskStatusConfig(
  status: JobStatus | string,
  size: "sm" | "md" = "md"
): { label: string; icon: React.ReactNode; color: string } {
  const config = TASK_STATUS_CONFIG[status as JobStatus] || TASK_STATUS_CONFIG.pending;

  return {
    label: config.label,
    icon: getTaskIcon(config.iconName, size),
    color: config.color,
  };
}

/**
 * 格式化任务创建时间为相对时间
 */
export function formatTaskTime(createdAt: Date | string | null | undefined): string {
  if (!createdAt) return "";

  try {
    return formatDistanceToNow(new Date(createdAt), {
      addSuffix: true,
      locale: zhCN,
    });
  } catch {
    return "";
  }
}

