/**
 * Asset系统的TypeScript类型定义
 */

import type { AspectRatio } from "@/lib/services/image.service";

// ===== 基础类型 =====

/**
 * 资产类型枚举（数据库层面）
 */
export type AssetTypeEnum = "image" | "video" | "text" | "audio";

/**
 * 资产来源类型
 */
export type AssetSourceType = "generated" | "uploaded";

/**
 * 资产筛选状态
 */
export type AssetSelectionStatus = "unrated" | "selected" | "rejected";

/**
 * 资产类型值（用于分类/标签）
 */
export type AssetType = 
  | "character"    // 角色图
  | "scene"        // 场景图
  | "prop"         // 道具图
  | "effect"       // 特效图
  | "reference";   // 参考图

/**
 * 资产状态（运行时计算，不再是数据库字段）
 * 注意：从数据库移除后，状态通过关联的job动态计算
 */
export type AssetStatus = 
  | "pending"      // 等待处理
  | "processing"   // 处理中
  | "completed"    // 已完成
  | "failed";      // 失败

// ===== Meta数据结构 =====

/**
 * 角色类型的meta数据
 */
export interface CharacterMeta {
  description?: string;      // 角色描述（性格、背景）
  appearance?: string;        // 外貌描述
  emotion?: string;           // 情绪状态
  pose?: string;              // 姿势
  isPrimary?: boolean;        // 是否为主要参考图
}

/**
 * 场景类型的meta数据
 */
export interface SceneMeta {
  description?: string;       // 场景描述
  timeOfDay?: string;         // 时间（早晨、下午等）
  weather?: string;           // 天气
  viewAngle?: string;         // 视角（45度俯视等）
  lighting?: string;          // 光照
}

/**
 * 道具类型的meta数据
 */
export interface PropMeta {
  description?: string;       // 道具描述
  category?: string;          // 分类
}

/**
 * 文本资产类型的meta数据
 */
export interface TextAssetMeta {
  category?: string;          // 分类（角色小传、剧本、分镜等）
  version?: number;           // 版本号
  author?: string;            // 作者
  lastModified?: string;      // 最后修改时间
}

/**
 * 音频用途类型 - AI 通过此字段理解音频的用法
 */
export type AudioPurpose = "voiceover" | "sound_effect" | "bgm";

/**
 * 音频资产类型的meta数据
 */
export interface AudioMeta {
  // 用途分类（关键字段，AI 用此判断如何使用）
  purpose: AudioPurpose;

  // 配音专属字段
  voiceover?: {
    character?: string;       // 角色名（对白用）
    emotion?: string;         // 情感（happy, sad, angry, neutral）
    language?: string;        // 语言代码 (zh-CN, en-US)
    voiceId?: string;         // TTS 声音模型 ID
    speakingRate?: number;    // 语速 (0.5-2.0)
    pitch?: number;           // 音调 (-12 to 12)
    transcript?: string;      // 音频文本内容
  };

  // 音效专属字段
  soundEffect?: {
    category?: string;        // 分类（explosion, footstep, ambient）
    intensity?: string;       // 强度（soft, medium, loud）
    environment?: string;     // 环境（indoor, outdoor）
    isLoopable?: boolean;     // 是否可循环
  };

  // 背景音乐专属字段
  bgm?: {
    genre?: string;           // 风格（orchestral, electronic）
    mood?: string;            // 情绪（tense, peaceful, exciting）
    tempo?: number;           // BPM
    hasVocals?: boolean;      // 是否有人声
    isLoopable?: boolean;     // 是否可循环
  };

  // 通用字段
  description?: string;       // 描述
  sceneContext?: string;      // 适用场景
}

/**
 * 编辑参数（用于派生图片）
 */
export interface EditParams {
  strength?: number;          // 编辑强度
  mask?: string;              // 遮罩URL
  controlnet?: string;        // ControlNet类型
  [key: string]: unknown;     // 其他自定义参数
}

/**
 * 生成参数（用于资产图片生成）
 */
export interface GenerationParams {
  aspectRatio?: AspectRatio;  // 图片宽高比
  resolution?: "1K" | "2K" | "4K";  // 分辨率
  numImages?: number;         // 批量生成时的数量
  strength?: number;          // 图生图强度
}

/**
 * 图片生成配置（存储在 imageData.generationConfig）
 * 用于图生图模式，记录生成参数和版本快照
 */
export interface ImageGenerationConfig {
  aspectRatio?: AspectRatio;
  resolution?: "1K" | "2K" | "4K";
  numImages?: number;

  // 版本快照（内部使用，Job 创建时记录源资产的版本 ID，Worker 执行时优先使用）
  _versionSnapshot?: {
    source_image_version_ids?: string[];  // 源图片 imageData.id 数组，与 sourceAssetIds 一一对应
  };
}

/**
 * 视频配置（用于生成）
 *
 * 统一的首尾帧生成方式：
 * - 基于起始帧（必填）和结束帧（可选）生成视频
 * - 系统会自动使用配置的视频服务提供商（Sora2 / Seedance / Veo / Kling）
 * - Sora2 Pro 支持 10/15 秒时长
 */
export interface VideoGenerationConfig {
  prompt: string;                // 视频描述（必填）
  start_image_url: string;       // 起始帧（必填）
  end_image_url?: string;        // 结束帧（可选）
  aspect_ratio?: "16:9" | "9:16";  // 宽高比
  negative_prompt?: string;      // 负面提示词
  type: string;                  // 生成类型（image-to-video | reference-to-video）
  duration?: "10" | "15";   // 视频时长（秒），默认 10

  // 版本快照（内部使用，Job 创建时记录源资产的版本 ID，Worker 执行时优先使用）
  _versionSnapshot?: {
    start_image_version_id?: string;  // 起始帧 imageData.id
    end_image_version_id?: string;    // 结束帧 imageData.id
  };
}

/**
 * 完整的meta数据结构
 */
export interface AssetMeta {
  character?: CharacterMeta;
  scene?: SceneMeta;
  prop?: PropMeta;
  textAsset?: TextAssetMeta;
  audio?: AudioMeta;
  editParams?: EditParams;
  generationParams?: GenerationParams;  // 生成参数
  custom?: Record<string, unknown>;
}

// ===== 数据库表类型 =====

/**
 * Asset 基表类型（精简版）
 * 注意：类型特定字段已移至扩展表
 */
export interface Asset {
  id: string;
  projectId: string;
  userId: string;

  // 基本信息
  name: string;

  // 资产类型
  assetType: AssetTypeEnum;

  // 资产来源类型
  sourceType: AssetSourceType;

  // 资产筛选状态
  selectionStatus: AssetSelectionStatus;

  // 元数据（JSON字符串，存储 CharacterMeta、AudioMeta 等）
  meta: string | null;

  // 组织和排序
  order: number | null;

  // 统计
  usageCount: number;

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 图片数据表类型（支持版本化）
 * 一个 asset 可以有多个 imageData 记录，每个代表一个版本
 */
export interface ImageData {
  id: string;
  assetId: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  // 从 generationInfo 合并的生成信息
  prompt: string | null;
  seed: number | null;
  modelUsed: string | null;
  generationConfig: string | null;
  sourceAssetIds: string[] | null;
  // 版本控制
  isActive: boolean;
  createdAt: Date;
}

/**
 * 视频数据表类型（支持版本化）
 * 一个 asset 可以有多个 videoData 记录，每个代表一个版本
 */
export interface VideoData {
  id: string;
  assetId: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  duration: number | null;  // 毫秒
  // 从 generationInfo 合并的生成信息
  prompt: string | null;
  seed: number | null;
  modelUsed: string | null;
  generationConfig: string | null;
  sourceAssetIds: string[] | null;
  // 版本控制
  isActive: boolean;
  createdAt: Date;
}

/**
 * 文本数据表类型
 */
export interface TextData {
  assetId: string;
  textContent: string | null;
}

/**
 * 音频数据表类型
 */
export interface AudioData {
  assetId: string;
  audioUrl: string | null;
  duration: number | null;  // 毫秒
  format: string | null;    // mp3, wav, m4a
  sampleRate: number | null;  // Hz
  bitrate: number | null;   // kbps
  channels: number | null;  // 1(mono) / 2(stereo)
  // 波形数据（用于时间轴显示）
  waveformData: string | null;  // JSON: 波形采样点数组 number[]
  // 生成信息
  prompt: string | null;
  seed: number | null;
  modelUsed: string | null;
  generationConfig: string | null;
  sourceAssetIds: string[] | null;
}

/**
 * 创建 Asset 时的输入类型（基表）
 */
export interface CreateAssetInput {
  projectId: string;
  name: string;
  assetType: AssetTypeEnum;
  sourceType: AssetSourceType;
  meta?: AssetMeta;
  tags?: string[];
}

/**
 * 创建图片数据（版本）的输入类型
 */
export interface CreateImageDataInput {
  assetId: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  // 生成信息
  prompt?: string;
  seed?: number;
  modelUsed?: string;
  generationConfig?: string;
  sourceAssetIds?: string[];
  // 版本控制
  isActive?: boolean;
}

/**
 * 创建视频数据（版本）的输入类型
 */
export interface CreateVideoDataInput {
  assetId: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  // 生成信息
  prompt?: string;
  seed?: number;
  modelUsed?: string;
  generationConfig?: string;
  sourceAssetIds?: string[];
  // 版本控制
  isActive?: boolean;
}

/**
 * 创建文本数据的输入类型
 */
export interface CreateTextDataInput {
  assetId: string;
  textContent?: string;
}

/**
 * 创建音频数据的输入类型
 */
export interface CreateAudioDataInput {
  assetId: string;
  audioUrl?: string;
  duration?: number;
  format?: string;
  sampleRate?: number;
  bitrate?: number;
  channels?: number;
  // 生成信息
  prompt?: string;
  seed?: number;
  modelUsed?: string;
  generationConfig?: string;
  sourceAssetIds?: string[];
}

/**
 * 更新 Asset 时的输入类型（基表）
 */
export interface UpdateAssetInput {
  name?: string;
  meta?: AssetMeta;
}

/**
 * 更新图片数据（版本）的输入类型
 */
export interface UpdateImageDataInput {
  imageUrl?: string;
  thumbnailUrl?: string;
  // 生成信息
  prompt?: string;
  seed?: number;
  modelUsed?: string;
  generationConfig?: string;
  sourceAssetIds?: string[];
}

/**
 * 更新视频数据（版本）的输入类型
 */
export interface UpdateVideoDataInput {
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  // 生成信息
  prompt?: string;
  seed?: number;
  modelUsed?: string;
  generationConfig?: string;
  sourceAssetIds?: string[];
}

/**
 * 更新文本数据的输入类型
 */
export interface UpdateTextDataInput {
  textContent?: string;
}

/**
 * 更新音频数据的输入类型
 */
export interface UpdateAudioDataInput {
  audioUrl?: string;
  duration?: number;
  format?: string;
  sampleRate?: number;
  bitrate?: number;
  channels?: number;
  // 生成信息
  prompt?: string;
  seed?: number;
  modelUsed?: string;
  generationConfig?: string;
  sourceAssetIds?: string[];
}

/**
 * AssetTag表的完整类型（简化版本）
 */
export interface AssetTag {
  id: string;
  assetId: string;
  tagValue: string;  // 标签值，如"角色"、"场景"、"道具"或自定义标签
  createdAt: Date;
}

/**
 * 创建AssetTag时的输入类型
 */
export interface CreateAssetTagInput {
  assetId: string;
  tagValue: string;  // 标签值
}

// ===== 查询相关类型 =====

/**
 * 带标签的Asset（包含关联的tags）
 */
export interface AssetWithTags extends Asset {
  tags: AssetTag[];
}

/**
 * 带运行时状态的Asset（查询结果）
 * 用于前端显示，包含从job计算出的运行时状态
 */
export interface AssetWithRuntimeStatus extends Asset {
  tags: AssetTag[];
  runtimeStatus: AssetStatus;  // 从job计算得出的状态
  latestJob?: import("@/types/job").Job | null;  // 关联的最新job（可选）
  errorMessage?: string | null;  // 从job获取的错误信息
}

/**
 * 带完整数据的 Asset（包含所有扩展表数据）
 * 用于需要完整素材信息的场景
 */
export interface AssetWithFullData extends Asset {
  // 标签
  tags: AssetTag[];

  // 当前激活版本（便捷访问）
  imageData: ImageData | null;
  videoData: VideoData | null;
  textData: TextData | null;
  audioData: AudioData | null;

  // 所有版本列表（用于版本历史 UI）
  imageDataList: ImageData[];
  videoDataList: VideoData[];

  // 版本数量
  versionCount: number;

  // 运行时状态
  runtimeStatus: AssetStatus;
  errorMessage: string | null;

  // ========== 扁平化便捷属性 ==========
  // 这些属性在 enrichAssetWithFullData 中自动计算，方便前端直接使用

  /** 显示用 URL（缩略图优先，适用于卡片展示） */
  displayUrl: string | null;
  /** 媒体源 URL（图片/视频/音频的实际播放 URL） */
  mediaUrl: string | null;

  // 从 imageData 扁平化
  /** 图片 URL */
  imageUrl: string | null;
  /** 缩略图 URL */
  thumbnailUrl: string | null;

  // 从 videoData 扁平化
  /** 视频 URL */
  videoUrl: string | null;

  // 从 audioData 扁平化
  /** 音频 URL */
  audioUrl: string | null;

  // 从 textData 扁平化
  /** 文本内容 */
  textContent: string | null;

  // 通用
  /** 时长（毫秒，视频或音频） */
  duration: number | null;

  // 从激活版本 (imageData/videoData) 扁平化的生成信息
  /** 生成提示词 */
  prompt: string | null;
  /** 种子值 */
  seed: number | null;
  /** 使用的模型 */
  modelUsed: string | null;
  /** 生成配置 */
  generationConfig: string | null;
  /** 源素材 ID 列表 */
  sourceAssetIds: string[] | null;
  /** 最新关联任务 ID（用于重试等操作） */
  latestJobId: string | null;

  // ========== 其他版本生成状态 ==========
  /** 是否有其他版本（非激活）正在生成 */
  hasOtherVersionGenerating: boolean;
  /** 其他正在生成的版本的 Job（用于显示进度） */
  otherVersionJob: import("@/types/job").Job | null;
  /** 其他版本的状态：'pending' | 'processing' | null */
  otherVersionStatus: 'pending' | 'processing' | null;
}

/**
 * 带派生资产的Asset
 */
export interface AssetWithDerivations extends Asset {
  tags: AssetTag[];
  derivedAssets: Asset[];
}

/**
 * 资产查询过滤器
 */
export interface AssetQueryFilter {
  projectId: string;
  assetType?: AssetTypeEnum;  // 资产类型过滤（image/video）
  tagFilters?: string[];  // 标签值数组，用于类型筛选如 ["角色", "场景"]
  search?: string;
  sourceAssetIds?: string[];  // 按源素材ID过滤（查询派生素材）
  limit?: number;
  offset?: number;
}

/**
 * 资产查询结果
 * 返回带完整数据和运行时状态的Asset
 */
export interface AssetQueryResult {
  assets: AssetWithFullData[];
  total: number;
  hasMore: boolean;
}

// ===== 派生相关类型 =====

/**
 * 创建派生资产的输入（便捷类型，内部会拆分到各表）
 */
export interface CreateDerivedAssetInput {
  projectId: string;
  assetType: AssetTypeEnum;
  name: string;
  meta?: AssetMeta;
  tags?: string[];
  editParams?: EditParams;

  // 生成信息
  sourceAssetIds: string[];
  prompt?: string;
  seed?: number;
  modelUsed?: string;
  generationConfig?: string;

  // 图片数据（assetType 为 image 时）
  imageUrl?: string;
  thumbnailUrl?: string;

  // 视频数据（assetType 为 video 时）
  videoUrl?: string;
  videoDuration?: number;

  // 音频数据（assetType 为 audio 时）
  audioUrl?: string;
  audioDuration?: number;
  audioFormat?: string;
}

// ===== 辅助函数类型 =====

/**
 * 解析Asset的meta JSON字符串为对象
 */
export function parseAssetMeta(metaJson: string | null): AssetMeta | null {
  if (!metaJson) return null;
  try {
    return JSON.parse(metaJson) as AssetMeta;
  } catch {
    return null;
  }
}

/**
 * 将AssetMeta对象转换为JSON字符串
 */
export function stringifyAssetMeta(meta: AssetMeta): string {
  return JSON.stringify(meta);
}

/**
 * 获取Asset的所有标签值
 */
export function getAssetTagValues(asset: AssetWithTags): string[] {
  return asset.tags.map(tag => tag.tagValue);
}

/**
 * 检查Asset是否有指定标签
 */
export function hasAssetTag(asset: AssetWithTags, tagValue: string): boolean {
  return asset.tags.some(tag => tag.tagValue === tagValue);
}

// ===== 素材生成相关类型 =====

/**
 * 图片分辨率
 */
export type ImageResolution = "1K" | "2K" | "4K";

/**
 * 生成历史记录项
 */
export interface GenerationHistoryItem {
  id: string;
  prompt: string;
  assetType: AssetType;
  mode: "text-to-image" | "image-to-image";
  parameters: {
    aspectRatio?: AspectRatio;
    resolution?: ImageResolution;
    numImages?: number;
    sourceAssetIds?: string[];
  };
  timestamp: Date;
  resultAssetIds: string[];
  jobId?: string;
}

