/**
 * Asset 查询函数
 *
 * 使用 Drizzle relations 自动 join 扩展表
 * 返回 AssetWithFullData 类型，包含所有扩展数据和运行时状态
 */

import db from "@/lib/db";
import { asset, assetTag, job } from "@/lib/db/schemas/project";
import { eq, and, inArray, sql, SQL, desc } from "drizzle-orm";
import { enrichAssetWithFullData, enrichAssetsWithFullData } from "@/lib/utils/asset-status";
import type { Asset, AssetWithFullData, AssetTag as AssetTagType } from "@/types/asset";
import type { Job } from "@/types/job";

/**
 * 查询单个资产（完整数据 + 运行时状态）
 */
export async function getAssetWithFullData(
  assetId: string
): Promise<AssetWithFullData | null> {
  // 使用 relations 自动 join 所有扩展表
  const assetData = await db.query.asset.findFirst({
    where: eq(asset.id, assetId),
    with: {
      tags: true,
      generationInfo: true,
      imageData: true,
      videoData: true,
      textData: true,
      audioData: true,
    },
  });

  if (!assetData) {
    return null;
  }

  // 查询最新的关联 job
  const latestJob = await db.query.job.findFirst({
    where: and(
      eq(job.assetId, assetId),
      inArray(job.type, ['asset_image_generation', 'video_generation', 'audio_generation'])
    ),
    orderBy: [desc(job.createdAt)],
  });

  return enrichAssetWithFullData(
    assetData as Asset,
    assetData.tags as AssetTagType[],
    assetData.generationInfo,
    assetData.imageData,
    assetData.videoData,
    assetData.textData,
    assetData.audioData,
    latestJob as Job | null
  );
}

/**
 * 查询多个资产（完整数据 + 运行时状态）
 */
export async function queryAssetsWithFullData(
  whereClause?: SQL | undefined,
  orderByClause?: SQL | SQL[],
  limit?: number,
  offset?: number
): Promise<AssetWithFullData[]> {
  // 使用 relations 自动 join 所有扩展表
  const assetsData = await db.query.asset.findMany({
    where: whereClause,
    with: {
      tags: true,
      generationInfo: true,
      imageData: true,
      videoData: true,
      textData: true,
      audioData: true,
    },
    orderBy: orderByClause,
    limit,
    offset,
  });

  if (assetsData.length === 0) {
    return [];
  }

  // 批量查询所有关联的 jobs
  const assetIds = assetsData.map((a) => a.id);
  const jobsData = await db
    .select({
      assetId: job.assetId,
      job: job,
      rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${job.assetId} ORDER BY ${job.createdAt} DESC)`,
    })
    .from(job)
    .where(
      and(
        inArray(job.assetId, assetIds),
        inArray(job.type, ['asset_image_generation', 'video_generation', 'audio_generation'])
      )
    );

  // 过滤出每个 asset 的最新 job
  const latestJobs = jobsData.filter((row) => row.rn === 1);
  const jobsMap = new Map<string, Job>();
  for (const row of latestJobs) {
    if (row.assetId) {
      jobsMap.set(row.assetId, row.job as Job);
    }
  }

  return enrichAssetsWithFullData(assetsData as any, jobsMap);
}

/**
 * 查询项目资产（带过滤和分页）
 */
export async function queryProjectAssets(options: {
  projectId: string;
  assetType?: "image" | "video" | "text" | "audio";
  sourceType?: "generated" | "uploaded";
  tagFilters?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<AssetWithFullData[]> {
  const { projectId, assetType, sourceType, tagFilters, search, limit, offset } = options;

  // 构建 WHERE 条件
  const conditions: SQL[] = [eq(asset.projectId, projectId)];

  if (assetType) {
    conditions.push(eq(asset.assetType, assetType));
  }

  if (sourceType) {
    conditions.push(eq(asset.sourceType, sourceType));
  }

  if (search) {
    conditions.push(sql`${asset.name} ILIKE ${`%${search}%`}`);
  }

  // 标签过滤
  if (tagFilters && tagFilters.length > 0) {
    const assetsWithMatchingTags = await db
      .selectDistinct({ assetId: assetTag.assetId })
      .from(assetTag)
      .where(inArray(assetTag.tagValue, tagFilters));

    const matchingAssetIds = assetsWithMatchingTags.map((row) => row.assetId);
    if (matchingAssetIds.length === 0) {
      return [];
    }
    conditions.push(inArray(asset.id, matchingAssetIds));
  }

  return queryAssetsWithFullData(
    and(...conditions),
    desc(asset.createdAt),
    limit,
    offset
  );
}

/**
 * 统计资产数量（按状态分组）
 */
export async function countAssetsByStatus(projectId: string): Promise<{
  total: number;
  completed: number;
  pending: number;
  processing: number;
  failed: number;
}> {
  const assetsWithStatus = await queryProjectAssets({ projectId });

  const counts = {
    total: assetsWithStatus.length,
    completed: 0,
    pending: 0,
    processing: 0,
    failed: 0,
  };

  for (const assetData of assetsWithStatus) {
    counts[assetData.runtimeStatus]++;
  }

  return counts;
}

// ===== 向后兼容的别名 =====

/** @deprecated 使用 getAssetWithFullData */
export const getAssetWithStatus = getAssetWithFullData;

/** @deprecated 使用 queryAssetsWithFullData */
export const queryAssetsWithStatus = queryAssetsWithFullData;

/** @deprecated 使用 queryProjectAssets */
export const queryProjectAssetsWithStatus = queryProjectAssets;
