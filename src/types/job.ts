// 任务类型定义

export type JobType =
  | "batch_image_generation" // 批量图像生成
  | "asset_image_generation" // 素材图片生成
  | "video_generation" // 视频生成
  | "shot_video_generation" // 单镜视频生成
  | "batch_video_generation" // 批量视频生成
  | "shot_tts_generation" // 单镜TTS生成
  | "final_video_export"; // 最终成片导出

export type JobStatus = 
  | "pending" // 等待处理
  | "processing" // 处理中
  | "completed" // 已完成
  | "failed" // 失败
  | "cancelled"; // 已取消

export interface Job {
  id: string;
  userId: string;
  projectId: string | null;
  type: JobType;
  status: JobStatus;
  parentJobId?: string | null; // 父任务ID
  progress: number; // 0-100
  totalSteps: number | null;
  currentStep: number;
  progressMessage: string | null;
  inputData: string | null; // JSON string
  resultData: string | null; // JSON string
  errorMessage: string | null;
  isImported: boolean; // 是否已导入（用于提取类任务）
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}

// 各种任务的输入数据类型

export interface BatchImageGenerationInput {
  prompts: Array<{
    id: string;
    prompt: string;
  }>;
  aspectRatio?: string;
  resolution?: string;
}

export interface VideoGenerationInput {
  shotId: string;
  imageUrl?: string;
}

// 素材图片生成输入
export interface AssetImageGenerationInput {
  projectId: string;
  prompt: string;
  // 素材元数据（可选，Agent 提供时直接使用，否则由 AI 分析 prompt 生成）
  name?: string;
  tags?: string[];  // 包含类型标签如 "角色"、"场景"、"道具" 等
  // 生成参数
  aspectRatio?: string;
  resolution?: "1K" | "2K" | "4K";
  numImages?: number;
  // 参考图（用于图生图）
  sourceAssetIds?: string[];
  // 生成模式（可选，有 sourceAssetIds 时自动使用 image-to-image）
  mode?: "text-to-image" | "image-to-image";
}

export interface BatchImageGenerationResult {
  results: Array<{
    id: string;
    imageUrl: string;
    success: boolean;
    error?: string;
  }>;
}

export interface VideoGenerationResult {
  videoUrl: string;
  duration: number;
}

// 素材图片生成结果
export interface AssetImageGenerationResult {
  assets: Array<{
    id: string;
    name: string;
    imageUrl: string;
    thumbnailUrl?: string;
    tags: string[];
  }>;
  successCount: number;
  failedCount: number;
  errors?: string[];
}

// 单镜视频生成输入
export interface ShotVideoGenerationInput {
  shotId: string;
  imageUrl: string; // 图片URL（从关联的 imageAsset 获取）
  prompt: string; // 运动提示词
  duration: "5" | "10"; // 视频时长
  regenerate?: boolean; // 是否重新生成
}

// 单镜视频生成结果
export interface ShotVideoGenerationResult {
  shotId: string;
  videoUrl: string;
  duration: number;
}

// 批量视频生成输入
export interface BatchVideoGenerationInput {
  shotIds: string[];
  concurrency?: number; // 并发数，默认3
}

// 批量视频生成结果
export interface BatchVideoGenerationResult {
  results: Array<{
    shotId: string;
    success: boolean;
    videoUrl?: string;
    error?: string;
  }>;
  totalCount: number;
  successCount: number;
  failedCount: number;
}

// 单镜TTS生成输入
export interface ShotTTSGenerationInput {
  shotId: string;
  dialogues: Array<{
    dialogueId: string;
    text: string;
    characterName?: string;
    emotionTag?: string;
  }>;
}

// 单镜TTS生成结果
export interface ShotTTSGenerationResult {
  shotId: string;
  audioFiles: Array<{
    dialogueId: string;
    audioUrl: string;
  }>;
  finalAudioUrl?: string; // 合并后的音频
}

// 最终成片导出输入
export interface FinalVideoExportInput {
  episodeId: string;
  includeAudio?: boolean; // 是否包含音频
  includeSubtitles?: boolean; // 是否包含字幕
  exportQuality?: "draft" | "high"; // 草稿/高清
  transitions?: Array<{
    fromShotId?: string;
    toShotId: string;
    type: string;
    duration: number;
  }>;
}

// 最终成片导出结果
export interface FinalVideoExportResult {
  episodeId: string;
  videoUrl: string;
  duration: number; // 总时长（秒）
  fileSize: number; // 文件大小（字节）
  videoList?: Array<{
    order: number;
    videoUrl: string;
    duration: number;
    dialogues: Array<{
      text: string;
      startTime: number | null;
      duration: number | null;
    }>;
  }>;
}

// 创建任务的参数
export interface CreateJobParams {
  userId: string;
  projectId?: string;
  type: JobType;
  inputData: unknown;
  totalSteps?: number;
  parentJobId?: string; // 父任务ID
}

// 更新任务进度的参数
export interface UpdateJobProgressParams {
  jobId: string;
  progress: number;
  currentStep?: number;
  progressMessage?: string;
}

// 完成任务的参数
export interface CompleteJobParams {
  jobId: string;
  resultData: unknown;
}

// 任务失败的参数
export interface FailJobParams {
  jobId: string;
  errorMessage: string;
}

