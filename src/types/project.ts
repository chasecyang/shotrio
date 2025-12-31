import { project, episode } from "@/lib/db/schemas/project";
import type { ArtStyle } from "./art-style";
import type { Asset as AssetType, AssetWithTags } from "./asset";

// 类型推导
export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;

export type Episode = typeof episode.$inferSelect;
export type NewEpisode = typeof episode.$inferInsert;

// 重新导出Asset类型
export type { AssetType, AssetWithTags };

// 业务类型

export interface ProjectWithStats extends Project {
  episodeCount: number;
  assetCount: number; // 统一包含图片和视频
}

export interface ProjectDetail extends Project {
  episodes: Episode[];
  assets?: AssetWithTags[]; // 包含图片和视频
  artStyle?: ArtStyle | null;
}

// 剧本详情类型
export interface ScriptDetail extends Episode {
  project?: {
    title: string;
  };
}

// 剧集信息完整性检查
export function isEpisodeComplete(episode: Episode): boolean {
  return !!(episode.summary && episode.scriptContent);
}
