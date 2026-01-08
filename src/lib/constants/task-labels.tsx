import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Ban,
  Sparkles,
  Film,
  Video,
  Music,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { JobType, JobStatus } from "@/types/job";

/**
 * Task type configuration
 */
export interface TaskTypeConfig {
  labelKey: string; // Translation key
  iconName: string;
}

// Icon name mapping for task types
export const TASK_TYPE_ICONS: Record<JobType, string> = {
  asset_image: "Sparkles",
  asset_video: "Video",
  asset_audio: "Music",
  final_video_export: "Film",
};

/**
 * Task status configuration
 */
export interface TaskStatusConfig {
  labelKey: string; // Translation key
  iconName: string;
  color: string;
}

// Status configuration with translation keys
export const TASK_STATUS_ICONS: Record<JobStatus, { iconName: string; color: string }> = {
  pending: {
    iconName: "Clock",
    color: "text-yellow-600 dark:text-yellow-400",
  },
  processing: {
    iconName: "Loader2",
    color: "text-blue-600 dark:text-blue-400",
  },
  completed: {
    iconName: "CheckCircle2",
    color: "text-green-600 dark:text-green-400",
  },
  failed: {
    iconName: "XCircle",
    color: "text-red-600 dark:text-red-400",
  },
  cancelled: {
    iconName: "Ban",
    color: "text-gray-600 dark:text-gray-400",
  },
};

/**
 * Viewable task types list
 */
export const VIEWABLE_TASK_TYPES: JobType[] = [];

/**
 * Icon mapping
 */
const iconMap = {
  Sparkles,
  Film,
  Video,
  Music,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
};

/**
 * Get task icon component by icon name and size
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
 * Get task type label with translation function
 * Use this in client components with useTranslations
 */
export function getTaskTypeLabel(
  type: JobType | string,
  t: (key: string) => string,
  size: "sm" | "md" = "md"
): { label: string; icon: React.ReactNode } {
  const iconName = TASK_TYPE_ICONS[type as JobType];
  const labelKey = `tasks.types.${type}`;
  
  return {
    label: t(labelKey) || t('tasks.types.unknown'),
    icon: iconName ? getTaskIcon(iconName, size) : null,
  };
}

/**
 * Get task status config with translation function
 * Use this in client components with useTranslations
 */
export function getTaskStatusConfig(
  status: JobStatus | string,
  t: (key: string) => string,
  size: "sm" | "md" = "md"
): { label: string; icon: React.ReactNode; color: string } {
  const config = TASK_STATUS_ICONS[status as JobStatus] || TASK_STATUS_ICONS.pending;
  const labelKey = `tasks.status.${status}`;

  return {
    label: t(labelKey),
    icon: getTaskIcon(config.iconName, size),
    color: config.color,
  };
}

/**
 * Format task time as relative time
 * Note: Locale should be passed from a hook that detects current language
 */
export function formatTaskTime(
  createdAt: Date | string | null | undefined
): string {
  if (!createdAt) return "";

  try {
    return formatDistanceToNow(new Date(createdAt), {
      addSuffix: true,
    });
  } catch {
    return "";
  }
}

