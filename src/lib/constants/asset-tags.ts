/**
 * 资产标签预设配置
 * 
 * 这些是系统提供的快捷标签，用户可以快速选择
 * 用户也可以添加完全自定义的标签
 */

/**
 * 预设标签列表（类型标签）
 */
export const PRESET_TAGS = [
  "角色",
  "场景", 
  "道具",
  "分镜",
  "特效",
  "参考",
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

