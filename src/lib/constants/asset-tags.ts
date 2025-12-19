/**
 * 资产标签预设配置
 * 
 * 这些是系统提供的快捷标签，用户可以快速选择
 * 用户也可以添加完全自定义的标签
 */

/**
 * 预设标签列表
 */
export const PRESET_TAGS = [
  "角色",
  "场景", 
  "道具",
] as const;

/**
 * 预设标签类型
 */
export type PresetTag = typeof PRESET_TAGS[number];

/**
 * 检查是否为预设标签
 */
export function isPresetTag(tag: string): tag is PresetTag {
  return PRESET_TAGS.includes(tag as PresetTag);
}

/**
 * 资产类型到预设标签的映射（用于自动添加标签）
 */
export const ASSET_TYPE_TO_TAG_MAP: Record<string, string> = {
  character: "角色",
  scene: "场景",
  prop: "道具",
  storyboard: "分镜",
  effect: "特效",
  reference: "参考",
};

/**
 * 根据资产类型获取建议的标签
 */
export function getSuggestedTagForAssetType(assetType: string): string | undefined {
  return ASSET_TYPE_TO_TAG_MAP[assetType];
}

