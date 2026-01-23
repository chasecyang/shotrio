import { project } from "@/lib/db/schemas/project";
import type { Asset as AssetType, AssetWithTags } from "./asset";

// 类型推导
export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;

// 重新导出Asset类型
export type { AssetType, AssetWithTags };

// 业务类型

export interface ProjectWithStats extends Project {
  assetCount: number; // 统一包含图片和视频
}

export interface ProjectDetail extends Project {
  assets?: AssetWithTags[]; // 包含图片和视频
}
