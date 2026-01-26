/**
 * 资产标签预设配置
 *
 * 这些是系统提供的快捷标签，用户可以快速选择
 * 用户也可以添加完全自定义的标签
 *
 * 标签值使用英文键名存储，UI 显示时通过 i18n 翻译
 */

/**
 * 预设标签列表（类型标签）- 使用英文键名
 */
export const PRESET_TAGS = [
  // 视觉素材标签
  "character",
  "scene",
  "prop",
  "effect",
  "reference",
  // 音频素材标签
  "voiceover",
  "soundEffect",
  "bgm",
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
 * 未分类分组名称 - 使用英文键名
 */
export const UNCATEGORIZED_GROUP = "uncategorized";

/**
 * 旧标签到新标签的映射（用于数据迁移兼容）
 */
export const LEGACY_TAG_MAP: Record<string, PresetTag> = {
  "角色": "character",
  "场景": "scene",
  "道具": "prop",
  "特效": "effect",
  "参考": "reference",
  "配音": "voiceover",
  "音效": "soundEffect",
  "背景音乐": "bgm",
  "未分类": "uncategorized" as PresetTag,
};

/**
 * 将旧标签转换为新标签
 */
export function migrateLegacyTag(tag: string): string {
  return LEGACY_TAG_MAP[tag] || tag;
}

