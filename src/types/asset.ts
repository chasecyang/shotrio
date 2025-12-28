/**
 * Asset系统的TypeScript类型定义
 */

import type { AspectRatio } from "@/lib/services/fal.service";

// ===== 基础类型 =====

/**
 * 资产派生类型
 */
export type DerivationType = 
  | "generate"     // 直接生成
  | "img2img"      // 图生图
  | "inpaint"      // 局部重绘
  | "edit"         // 编辑
  | "remix"        // 混合
  | "composite";   // 合成

/**
 * 资产类型值（用于分类）
 */
export type AssetType = 
  | "character"    // 角色图
  | "scene"        // 场景图
  | "prop"         // 道具图
  | "storyboard"   // 分镜图
  | "effect"       // 特效图
  | "reference";   // 参考图

/**
 * 资产状态（运行时计算字段）
 */
export type AssetStatus = 
  | "completed"    // 图片已生成完成（有imageUrl）
  | "generating";  // 图片正在生成中（imageUrl为null）

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
 * 分镜类型的meta数据
 */
export interface StoryboardMeta {
  shotId?: string;            // 关联的分镜ID
  composition?: string;       // 构图方式
  lighting?: string;          // 光照
  sourceAssets?: string[];    // 使用的源素材ID列表
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
 * 完整的meta数据结构
 */
export interface AssetMeta {
  character?: CharacterMeta;
  scene?: SceneMeta;
  prop?: PropMeta;
  storyboard?: StoryboardMeta;
  editParams?: EditParams;
  generationParams?: GenerationParams;  // 生成参数
  custom?: Record<string, unknown>;
}

// ===== 数据库表类型 =====

/**
 * Asset表的完整类型
 */
export interface Asset {
  id: string;
  projectId: string;
  userId: string;
  
  // 基本信息
  name: string;
  
  // 图片资源（可为空，表示素材正在生成中）
  imageUrl: string | null;
  thumbnailUrl: string | null;
  
  // 生成信息
  prompt: string | null;
  seed: number | null;
  modelUsed: string | null;
  
  // 派生关系
  sourceAssetIds: string[] | null;  // 多个源素材ID（用于图生图）
  derivationType: DerivationType | null;
  
  // 元数据
  meta: string | null;  // JSON字符串
  
  // 统计
  usageCount: number;
  
  // 时间戳
  createdAt: Date;
  updatedAt: Date;
  
  // 运行时计算字段（不在数据库中，由查询函数添加）
  status?: AssetStatus;
}

/**
 * 创建Asset时的输入类型
 */
export interface CreateAssetInput {
  projectId: string;
  name: string;
  imageUrl?: string;  // 可选，为空表示素材正在生成中
  thumbnailUrl?: string;
  prompt?: string;
  seed?: number;
  modelUsed?: string;
  sourceAssetIds?: string[];  // 多个源素材ID（用于图生图）
  derivationType?: DerivationType;
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
  tagFilters?: string[];  // 标签值数组，用于类型筛选如 ["角色", "场景"]
  search?: string;
  sourceAssetIds?: string[];  // 按源素材ID过滤（查询派生素材）
  limit?: number;
  offset?: number;
}

/**
 * 资产查询结果
 */
export interface AssetQueryResult {
  assets: AssetWithTags[];
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
  derivationType: DerivationType;
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

/**
 * 计算Asset的状态
 */
export function getAssetStatus(asset: Asset): AssetStatus {
  return asset.imageUrl ? "completed" : "generating";
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

