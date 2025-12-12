// 任务类型定义

export type JobType =
  | "novel_split" // 小说拆分
  | "character_extraction" // 角色提取
  | "scene_extraction" // 场景提取
  | "character_image_generation" // 角色造型生成
  | "scene_image_generation" // 场景视角生成
  | "storyboard_generation" // 剧本自动分镜（触发入口）
  | "storyboard_basic_extraction" // 基础分镜提取（第一步）
  | "storyboard_matching" // 角色场景匹配（第二步）
  | "batch_image_generation" // 批量图像生成
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

export interface SceneExtractionInput {
  episodeIds: string[];
}

export interface CharacterImageGenerationInput {
  characterId: string;
  imageId: string; // characterImage 的 ID，用于更新
  regenerate?: boolean; // 是否重新生成已有图片
}

export interface SceneImageGenerationInput {
  sceneId: string;
  imageId: string; // sceneImage 的 ID，用于更新
  regenerate?: boolean; // 是否重新生成已有图片
}

export interface StoryboardGenerationInput {
  episodeId: string;
  autoGenerateImages?: boolean;
}

// 基础分镜提取输入（第一步）
export interface StoryboardBasicExtractionInput {
  episodeId: string;
  parentJobId?: string; // 父任务ID，用于追溯
}

// 角色场景匹配输入（第二步）
export interface StoryboardMatchingInput {
  episodeId: string;
  basicExtractionJobId: string; // 第一步任务的ID，用于读取基础提取结果
  parentJobId?: string; // 父任务ID，用于追溯
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
  characters: Array<{
    name: string;
    description: string;
    appearance: string;
    styles: Array<{
      label: string;
      prompt: string;
    }>;
  }>;
  characterCount: number;
}

export interface SceneExtractionResult {
  scenes: Array<{
    name: string;
    description: string;
  }>;
  sceneCount: number;
}

export interface CharacterImageGenerationResult {
  imageId: string; // 生成的 characterImage ID
  imageUrl: string; // 生成的图片URL
}

export interface SceneImageGenerationResult {
  imageId: string; // 生成的 sceneImage ID
  imageUrl: string; // 生成的图片URL
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

// 角色场景匹配结果（第二步）
export interface StoryboardMatchingResult {
  shots: Array<{
    order: number;
    shotSize: string;
    cameraMovement: string;
    duration: number;
    visualDescription: string;
    visualPrompt: string;
    audioPrompt?: string;
    sceneName?: string;
    sceneId?: string; // 匹配后的场景ID
    sceneMatchConfidence?: number;
    characters: Array<{
      name: string;
      characterId?: string; // 匹配后的角色ID
      characterImageId?: string; // 匹配后的角色造型ID
      position?: string;
      action?: string;
      matchConfidence?: number;
    }>;
    dialogues: Array<{
      characterName?: string;
      characterId?: string; // 匹配后的角色ID
      dialogueText: string;
      emotionTag?: string;
      order: number;
      matchConfidence?: number;
    }>;
  }>;
  shotCount: number;
  matchedSceneCount: number;
  matchedCharacterCount: number;
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

