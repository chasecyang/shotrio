import { project, episode, character, shot, characterImage } from "@/lib/db/schemas/project";

// 类型推导
export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;

export type Episode = typeof episode.$inferSelect;
export type NewEpisode = typeof episode.$inferInsert;

export type Character = typeof character.$inferSelect;
export type NewCharacter = typeof character.$inferInsert;

export type CharacterImage = typeof characterImage.$inferSelect;
export type NewCharacterImage = typeof characterImage.$inferInsert;

export type Shot = typeof shot.$inferSelect;
export type NewShot = typeof shot.$inferInsert;

// 业务类型

export interface ProjectWithStats extends Project {
  episodeCount: number;
  characterCount: number;
}

export interface EpisodeWithShots extends Episode {
  shots: Shot[];
}

export interface ProjectDetail extends Project {
  episodes: Episode[];
  characters: (Character & { images: CharacterImage[] })[];
}

// 剧本详情类型
export interface ScriptDetail extends Episode {
  project?: {
    title: string;
  };
}

// 分镜相关类型
export interface ShotDetail extends Shot {
  mainCharacter?: Character | null;
}

export interface ShotWithCharacter extends Shot {
  character?: Character | null;
}

// 景别类型
export type ShotSize =
  | "extreme_long_shot"
  | "long_shot"
  | "full_shot"
  | "medium_shot"
  | "close_up"
  | "extreme_close_up";

// 剧集信息完整性检查
export function isEpisodeComplete(episode: Episode): boolean {
  return !!(episode.summary && episode.hook && episode.scriptContent);
}

// 小说拆分相关类型
export interface NovelEpisodeData {
  order: number;
  title: string;
  summary: string;
  hook: string;
  scriptContent: string;
}

export interface NovelSplitResult {
  episodes: NovelEpisodeData[];
}

export interface NovelImportOptions {
  targetEpisodeLength?: number; // 目标每集时长（秒）
  maxEpisodes?: number; // 最大剧集数
}

// 角色提取相关类型
export interface ExtractedCharacterStyle {
  label: string; // 造型名称（如"日常装"、"工作装"）
  prompt: string; // 英文图像生成prompt
}

export interface ExtractedCharacter {
  name: string; // 角色名称
  description: string; // 性格描述
  appearance: string; // 基础外貌（固定特征）
  styles: ExtractedCharacterStyle[]; // 不同造型
  isExisting?: boolean; // 是否已存在（前端状态）
  existingId?: string; // 已存在角色的ID（前端状态）
  newStylesCount?: number; // 将要添加的新造型数量（前端状态）
}

export interface CharacterExtractionResult {
  characters: ExtractedCharacter[];
}

// 导入角色时的数据结构
export interface CharacterToImport extends ExtractedCharacter {
  selected: boolean; // 是否选中要导入
}




