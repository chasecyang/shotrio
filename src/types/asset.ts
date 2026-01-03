/**
 * Asset系统的TypeScript类型定义
 */

import type { AspectRatio } from "@/lib/services/fal.service";

// ===== 基础类型 =====

/**
 * 资产类型枚举（数据库层面）
 */
export type AssetTypeEnum = "image" | "video" | "text";

/**
 * 资产来源类型
 */
export type AssetSourceType = "generated" | "uploaded";

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
 * 视频配置（用于生成）
 * 
 * Agent 层面支持两种生成方式：
 * - image-to-video: 首尾帧过渡
 * - reference-to-video: 参考生成（多图参考或视频续写）
 * 
 * 内部实现：
 * - type 字段会根据 video_url 自动设置为 video-to-video
 * - 这样 Agent 只需要区分"首尾帧"和"参考生成"两种语义
 * - 实际调用哪个 API 由系统根据参数自动判断
 */
export interface VideoGenerationConfig {
  // 生成方式标识（内部使用，由系统自动设置）
  type?: "image-to-video" | "reference-to-video" | "video-to-video";
  
  // 模型层级（预留Pro版本支持）
  modelTier?: "standard" | "pro";
  
  // 通用字段
  prompt: string;
  duration?: "5" | "10";
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  negative_prompt?: string;
  
  // image-to-video 特定字段
  start_image_url?: string;      // 起始帧
  end_image_url?: string;        // 结束帧
  
  // reference-to-video 特定字段
  elements?: Array<{
    frontal_image_url: string;
    reference_image_urls?: string[];
  }>;
  image_urls?: string[];         // 场景参考图（也用于视频续写的风格参考）
  
  // 视频续写特定字段（传入后自动触发 video-to-video API）
  video_url?: string;            // 参考视频，存在时 type 自动设为 video-to-video
}

/**
 * 完整的meta数据结构
 */
export interface AssetMeta {
  character?: CharacterMeta;
  scene?: SceneMeta;
  prop?: PropMeta;
  textAsset?: TextAssetMeta;
  editParams?: EditParams;
  generationParams?: GenerationParams;  // 生成参数
  custom?: Record<string, unknown>;
}

// ===== 数据库表类型 =====

/**
 * Asset表的完整类型
 * 注意：status和errorMessage已从数据库移除，改为从job动态计算
 */
export interface Asset {
  id: string;
  projectId: string;
  userId: string;
  
  // 基本信息
  name: string;
  
  // 资产类型
  assetType: AssetTypeEnum;
  
  // 资产来源类型（新增）
  sourceType: AssetSourceType;
  
  // 图片字段（图片类型必填）
  imageUrl: string | null;
  thumbnailUrl: string | null;
  
  // 视频字段（视频类型必填）
  videoUrl: string | null;
  duration: number | null; // 毫秒
  
  // 文本字段（文本类型必填）
  textContent: string | null;
  textFormat: string | null; // 'markdown' | 'plain'
  
  // 生成信息
  prompt: string | null;
  seed: number | null;
  modelUsed: string | null;
  
  // 生成配置（主要用于视频）
  generationConfig: string | null; // JSON
  
  // 派生关系
  sourceAssetIds: string[] | null;  // 多个源素材ID（用于图生图）
  
  // 元数据
  meta: string | null;  // JSON字符串
  
  // 注意：以下字段已移除，状态从job动态计算
  // status: AssetStatus; // ❌ 已移除
  // errorMessage: string | null; // ❌ 已移除
  
  // 组织和排序
  order: number | null;
  
  // 统计
  usageCount: number;
  
  // 时间戳
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建Asset时的输入类型
 */
export interface CreateAssetInput {
  projectId: string;
  name: string;
  sourceType?: AssetSourceType;  // 新增：资产来源类型
  imageUrl?: string;  // 可选，为空表示素材正在生成中
  thumbnailUrl?: string;
  textContent?: string;  // 文本内容（文本类型必填）
  textFormat?: string;   // 文本格式（'markdown' | 'plain'）
  prompt?: string;
  seed?: number;
  modelUsed?: string;
  sourceAssetIds?: string[];  // 多个源素材ID（用于图生图）
  meta?: AssetMeta;
  tags?: string[];  // 简化为标签值数组
}

/**
 * 更新Asset时的输入类型
 */
export interface UpdateAssetInput {
  name?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  textContent?: string;
  textFormat?: string;
  prompt?: string;
  seed?: number;
  modelUsed?: string;
  meta?: AssetMeta;
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
 * 注意：现在返回带运行时状态的Asset
 */
export interface AssetQueryResult {
  assets: AssetWithRuntimeStatus[];
  total: number;
  hasMore: boolean;
}

// ===== 派生相关类型 =====

/**
 * 创建派生资产的输入
 */
export interface CreateDerivedAssetInput {
  projectId: string;
  sourceAssetIds: string[];  // 源素材ID数组
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  prompt?: string;
  seed?: number;
  modelUsed?: string;
  editParams?: EditParams;
  meta?: AssetMeta;
  tags?: string[];  // 简化为标签值数组
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

