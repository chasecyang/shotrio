import { project, episode, shot, asset } from "@/lib/db/schemas/project";
import type { ArtStyle } from "./art-style";
import type { Asset as AssetType, AssetWithTags } from "./asset";

// 类型推导
export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;

export type Episode = typeof episode.$inferSelect;
export type NewEpisode = typeof episode.$inferInsert;

export type Shot = typeof shot.$inferSelect;
export type NewShot = typeof shot.$inferInsert;

// 重新导出Asset类型
export type { AssetType, AssetWithTags };

// 业务类型

export interface ProjectWithStats extends Project {
  episodeCount: number;
  assetCount: number;
}

export interface EpisodeWithShots extends Episode {
  shots: Shot[];
}

export interface ProjectDetail extends Project {
  episodes: Episode[];
  assets?: AssetWithTags[];
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
  imageAsset?: AssetType | null;
}

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
