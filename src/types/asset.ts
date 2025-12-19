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
 * 完整的meta数据结构
 */
export interface AssetMeta {
  character?: CharacterMeta;
  scene?: SceneMeta;
  prop?: PropMeta;
  storyboard?: StoryboardMeta;
  editParams?: EditParams;
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
  
  // 图片资源
  imageUrl: string;
  thumbnailUrl: string | null;
  
  // 生成信息
  prompt: string | null;
  seed: number | null;
  modelUsed: string | null;
  
  // 派生关系
  sourceAssetId: string | null;
  derivationType: DerivationType | null;
  
  // 元数据
  meta: string | null;  // JSON字符串
  
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
  imageUrl: string;
  thumbnailUrl?: string;
  prompt?: string;
  seed?: number;
  modelUsed?: string;
  sourceAssetId?: string;
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
  sourceAsset?: Asset | null;
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
  tagFilters?: string[];  // 标签值数组，简化为只有值
  assetTypes?: AssetType[];
  search?: string;
  sourceAssetId?: string;
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
  sourceAssetId: string;
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

// ===== 素材生成相关类型 =====

/**
 * 图片分辨率
 */
export type ImageResolution = "1K" | "2K" | "4K";

