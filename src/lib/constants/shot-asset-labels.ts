/**
 * 分镜素材标签相关常量
 */

// 预设的分镜素材标签
export const PRESET_SHOT_ASSET_LABELS = [
  "首帧",
  "尾帧",
  "角色参考",
  "场景参考",
  "道具",
  "氛围参考",
  "构图参考",
  "背景",
] as const;

// 每个分镜最多可关联的素材数量
export const MAX_SHOT_ASSETS = 7;

// Label 最大长度限制
export const MAX_LABEL_LENGTH = 20;

export type PresetShotAssetLabel = (typeof PRESET_SHOT_ASSET_LABELS)[number];

