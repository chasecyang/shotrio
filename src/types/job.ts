// 任务类型定义

export type JobType =
  | "batch_image_generation" // 批量图像生成
  | "asset_image_generation" // 素材图片生成
  | "video_generation" // 视频生成
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
  assetId: string | null; // 关联的资产ID（可选，仅 video_generation 和 asset_image_generation 使用）
  parentJobId?: string | null; // 父任务ID
  progress: number; // 0-100
  totalSteps: number | null;
  currentStep: number;
  progressMessage: string | null;
  inputData: unknown | null; // JSONB type, auto-parsed by Drizzle
  resultData: unknown | null; // JSONB type, auto-parsed by Drizzle
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


// 最终成片导出输入
export interface FinalVideoExportInput {
  projectId: string;
  videoIds: string[]; // 要导出的视频片段ID列表（按顺序）
  includeAudio?: boolean; // 是否包含音频
  includeSubtitles?: boolean; // 是否包含字幕
  exportQuality?: "draft" | "high"; // 草稿/高清
  transitions?: Array<{
    fromVideoId?: string;
    toVideoId: string;
    type: string;
    duration: number;
  }>;
}

// 最终成片导出结果
export interface FinalVideoExportResult {
  projectId: string;
  videoUrl: string;
  duration: number; // 总时长（秒）
  fileSize: number; // 文件大小（字节）
  videoList?: Array<{
    videoId: string;
    order: number;
    videoUrl: string;
    duration: number;
  }>;
}

// 创建任务的参数
export interface CreateJobParams {
  userId: string;
  projectId?: string;
  type: JobType;
  assetId?: string; // 关联的资产ID（可选）
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

