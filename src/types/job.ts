// 任务类型定义

export type JobType =
  | "storyboard_generation" // 剧本自动分镜（触发入口）
  | "storyboard_basic_extraction" // 基础分镜提取（第一步）
  | "shot_decomposition" // 分镜拆解
  | "shot_image_generation" // 单个分镜图片生成
  | "batch_shot_image_generation" // 批量分镜图片生成
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
export interface StoryboardGenerationInput {
  episodeId: string;
  autoGenerateImages?: boolean;
}

// 基础分镜提取输入（第一步）
export interface StoryboardBasicExtractionInput {
  episodeId: string;
  parentJobId?: string; // 父任务ID，用于追溯
}

// @deprecated 已废弃 - 角色场景匹配功能已移除
export interface StoryboardMatchingInput {
  episodeId: string;
  basicExtractionJobId: string;
  parentJobId?: string;
}

// 分镜拆解输入
export interface ShotDecompositionInput {
  shotId: string;
  episodeId: string;
}

export interface BatchImageGenerationInput {
  prompts: Array<{
    id: string;
    prompt: string;
  }>;
  aspectRatio?: string;
  resolution?: string;
}

export interface ShotImageGenerationInput {
  shotId: string;
  regenerate?: boolean;
}

export interface BatchShotImageGenerationInput {
  shotIds: string[];
}

export interface VideoGenerationInput {
  shotId: string;
  imageUrl?: string;
}

// 素材图片生成输入
export interface AssetImageGenerationInput {
  projectId: string;
  prompt: string;
  assetType: "character" | "scene" | "prop" | "reference";
  aspectRatio?: string;
  resolution?: "1K" | "2K" | "4K";
  numImages?: number;
  // 参考图（用于图生图）
  sourceAssetIds?: string[];
  mode: "text-to-image" | "image-to-image";
}

// 任务结果数据类型
export interface ShotImageGenerationResult {
  shotId: string;
  imageUrl: string;
  dependencyJobIds?: string[]; // 依赖任务ID列表
}

export interface BatchShotImageGenerationResult {
  childJobIds: string[];
  totalShots: number;
}

export interface StoryboardGenerationResult {
  childJobIds?: string[]; // 子任务ID列表
  basicExtractionJobId?: string; // 第一步任务ID
  matchingJobId?: string; // 第二步任务ID
  message?: string;
}

// 基础分镜提取结果（第一步）
export interface StoryboardBasicExtractionResult {
  shots: Array<{
    order: number;
    shotSize: string;
    cameraMovement: string;
    duration: number;
    visualDescription: string;
    visualPrompt: string;
    audioPrompt?: string;
    sceneName?: string; // 场景名称（未匹配ID）
    characters: Array<{
      name: string; // 角色名称（未匹配ID）
      position?: string;
      action?: string;
    }>;
    dialogues: Array<{
      characterName?: string; // 说话人名称（未匹配ID）
      dialogueText: string;
      emotionTag?: string;
      order: number;
    }>;
  }>;
  shotCount: number;
}

// @deprecated 已废弃 - 角色场景匹配功能已移除
export interface StoryboardMatchingResult {
  shots: Array<Record<string, unknown>>;
  shotCount: number;
  matchedSceneCount: number;
  matchedCharacterCount: number;
}

// 分镜拆解结果
export interface ShotDecompositionResult {
  originalShotId: string;
  originalOrder: number; // 原分镜的顺序
  decomposedShots: Array<{
    order: number; // 子分镜的顺序（相对于原分镜）
    shotSize: string;
    cameraMovement: string;
    duration: number;
    visualDescription: string;
    visualPrompt: string;
    audioPrompt?: string;
    sceneId?: string; // 继承原分镜的场景ID
    characters: Array<{
      characterId: string;
      characterImageId?: string;
      position?: string;
      action?: string;
    }>;
    dialogues: Array<{
      characterId?: string;
      dialogueText: string;
      emotionTag?: string;
      order: number;
    }>;
  }>;
  decomposedCount: number;
  reasoningExplanation: string; // AI的拆解理由
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
  imageUrl: string; // 分镜图URL
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

