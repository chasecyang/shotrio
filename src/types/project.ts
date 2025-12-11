import { project, episode, character, shot, characterImage, scene, sceneImage, artStyle, shotCharacter, shotDialogue } from "@/lib/db/schemas/project";
import type { ArtStyle } from "./art-style";

// 类型推导
export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;

export type Episode = typeof episode.$inferSelect;
export type NewEpisode = typeof episode.$inferInsert;

export type Character = typeof character.$inferSelect;
export type NewCharacter = typeof character.$inferInsert;

export type CharacterImage = typeof characterImage.$inferSelect;
export type NewCharacterImage = typeof characterImage.$inferInsert;

export type Scene = typeof scene.$inferSelect;
export type NewScene = typeof scene.$inferInsert;

export type SceneImage = typeof sceneImage.$inferSelect;
export type NewSceneImage = typeof sceneImage.$inferInsert;

// 场景图片类型
export type SceneImageType = "master_layout" | "quarter_view";

export type Shot = typeof shot.$inferSelect;
export type NewShot = typeof shot.$inferInsert;

export type ShotCharacter = typeof shotCharacter.$inferSelect;
export type NewShotCharacter = typeof shotCharacter.$inferInsert;

export type ShotDialogue = typeof shotDialogue.$inferSelect;
export type NewShotDialogue = typeof shotDialogue.$inferInsert;

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
  scenes?: (Scene & { images: SceneImage[] })[];
  artStyle?: ArtStyle | null;
}

// 剧本详情类型
export interface ScriptDetail extends Episode {
  project?: {
    title: string;
  };
}

// 分镜相关类型
export interface ShotDetail extends Shot {
  shotCharacters: (ShotCharacter & {
    character: Character;
    characterImage?: CharacterImage | null;
  })[];
  dialogues: ShotDialogue[];
  scene?: Scene | null;
}

export interface ShotWithCharacter extends Shot {
  character?: Character | null;
}

// 情绪标签类型
export type EmotionTag = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'fearful' | 'disgusted';

// 角色位置类型
export type CharacterPosition = 'left' | 'center' | 'right' | 'foreground' | 'background';

// 景别类型
export type ShotSize =
  | "extreme_long_shot"
  | "long_shot"
  | "full_shot"
  | "medium_shot"
  | "close_up"
  | "extreme_close_up";


// 运镜类型
export type CameraMovement =
  | "static" // 固定镜头
  | "push_in" // 推镜头
  | "pull_out" // 拉镜头
  | "pan_left" // 左摇
  | "pan_right" // 右摇
  | "tilt_up" // 上摇
  | "tilt_down" // 下摇
  | "tracking" // 移动跟拍
  | "crane_up" // 升镜头
  | "crane_down" // 降镜头
  | "orbit" // 环绕
  | "zoom_in" // 变焦推进
  | "zoom_out" // 变焦拉远
  | "handheld"; // 手持

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

// 场景相关类型
export interface SceneWithImages extends Scene {
  images: SceneImage[];
}

export interface SceneDetail extends Scene {
  images: SceneImage[];
  masterLayout?: SceneImage;
  quarterView?: SceneImage;
}

// 场景提取相关类型
export interface ExtractedScene {
  name: string; // 场景名称
  description: string; // 场景描述
  isExisting?: boolean; // 是否已存在（前端状态）
  existingId?: string; // 已存在场景的ID（前端状态）
}

export interface SceneExtractionResult {
  scenes: ExtractedScene[];
}

// 导入场景时的数据结构
export interface SceneToImport extends ExtractedScene {
  selected: boolean; // 是否选中要导入
}
