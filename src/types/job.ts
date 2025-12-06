// 任务类型定义

export type JobType =
  | "novel_split" // 小说拆分
  | "character_extraction" // 角色提取
  | "character_image_generation" // 角色造型生成
  | "storyboard_generation" // 剧本自动分镜
  | "batch_image_generation" // 批量图像生成
  | "video_generation"; // 视频生成

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
  progress: number; // 0-100
  totalSteps: number | null;
  currentStep: number;
  progressMessage: string | null;
  inputData: string | null; // JSON string
  resultData: string | null; // JSON string
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}

// 各种任务的输入数据类型
export interface NovelSplitInput {
  content: string;
  maxEpisodes?: number;
}

export interface CharacterExtractionInput {
  episodeIds: string[];
}

export interface CharacterImageGenerationInput {
  characterId: string;
  imageId: string; // characterImage 的 ID，用于更新
  regenerate?: boolean; // 是否重新生成已有图片
}

export interface StoryboardGenerationInput {
  episodeId: string;
  autoGenerateImages?: boolean;
}

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

// 任务结果数据类型
export interface NovelSplitResult {
  episodeIds: string[];
  episodeCount: number;
}

export interface CharacterExtractionResult {
  characterIds: string[];
  characterCount: number;
}

export interface CharacterImageGenerationResult {
  imageId: string; // 生成的 characterImage ID
  imageUrl: string; // 生成的图片URL
}

export interface StoryboardGenerationResult {
  shotIds: string[];
  shotCount: number;
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

// 创建任务的参数
export interface CreateJobParams {
  userId: string;
  projectId?: string;
  type: JobType;
  inputData: unknown;
  totalSteps?: number;
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

