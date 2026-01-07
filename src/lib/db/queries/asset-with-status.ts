/**
 * Asset 查询函数
 *
 * 使用 Drizzle relations 自动 join 扩展表
 * 返回 AssetWithFullData 类型，包含所有扩展数据和运行时状态
 */

import db from "@/lib/db";
import { asset, assetTag, job, imageData, videoData } from "@/lib/db/schemas/project";
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
      imageDataList: {
        orderBy: desc(imageData.createdAt),
      },
      videoDataList: {
        orderBy: desc(videoData.createdAt),
      },
      textData: true,
      audioData: true,
    },
  });

  if (!assetData) {
    return null;
  }

  // 找到激活版本
  const activeImageData = assetData.imageDataList?.find((v: any) => v.isActive) ?? null;
  const activeVideoData = assetData.videoDataList?.find((v: any) => v.isActive) ?? null;

  // 查询激活版本关联的最新 job
  let latestJob = null;
  if (activeImageData?.id) {
    latestJob = await db.query.job.findFirst({
      where: eq(job.imageDataId, activeImageData.id),
      orderBy: [desc(job.createdAt)],
    });
  } else if (activeVideoData?.id) {
    latestJob = await db.query.job.findFirst({
      where: eq(job.videoDataId, activeVideoData.id),
      orderBy: [desc(job.createdAt)],
    });
  }

  // 如果新关联没找到，回退到旧的 assetId 关联（迁移兼容）
  if (!latestJob) {
    latestJob = await db.query.job.findFirst({
      where: and(
        eq(job.assetId, assetId),
        inArray(job.type, ['asset_image_generation', 'video_generation', 'audio_generation'])
      ),
      orderBy: [desc(job.createdAt)],
    });
  }

  return enrichAssetWithFullData(
    assetData as Asset,
    assetData.tags as AssetTagType[],
    assetData.imageDataList ?? [],
    assetData.videoDataList ?? [],
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
      imageDataList: {
        orderBy: desc(imageData.createdAt),
      },
      videoDataList: {
        orderBy: desc(videoData.createdAt),
      },
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

  // 收集所有激活版本的 ID
  const imageDataIds: string[] = [];
  const videoDataIds: string[] = [];
  const assetIds = assetsData.map((a) => a.id);

  for (const assetData of assetsData) {
    const activeImageData = assetData.imageDataList?.find((v: any) => v.isActive);
    const activeVideoData = assetData.videoDataList?.find((v: any) => v.isActive);
    if (activeImageData?.id) imageDataIds.push(activeImageData.id);
    if (activeVideoData?.id) videoDataIds.push(activeVideoData.id);
  }

  // 批量查询所有关联的 jobs（优先通过版本 ID，回退到 assetId）
  const jobsMap = new Map<string, Job>();

  // 查询版本关联的 jobs
  if (imageDataIds.length > 0) {
    const imageJobs = await db
      .select({
        imageDataId: job.imageDataId,
        job: job,
        rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${job.imageDataId} ORDER BY ${job.createdAt} DESC)`,
      })
      .from(job)
      .where(inArray(job.imageDataId, imageDataIds));

    for (const row of imageJobs) {
      if (row.rn === 1 && row.imageDataId) {
        // 找到对应的 assetId
        const assetData = assetsData.find((a: any) =>
          a.imageDataList?.some((v: any) => v.id === row.imageDataId)
        );
        if (assetData) {
          jobsMap.set(assetData.id, row.job as Job);
        }
      }
    }
  }

  if (videoDataIds.length > 0) {
    const videoJobs = await db
      .select({
        videoDataId: job.videoDataId,
        job: job,
        rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${job.videoDataId} ORDER BY ${job.createdAt} DESC)`,
      })
      .from(job)
      .where(inArray(job.videoDataId, videoDataIds));

    for (const row of videoJobs) {
      if (row.rn === 1 && row.videoDataId) {
        const assetData = assetsData.find((a: any) =>
          a.videoDataList?.some((v: any) => v.id === row.videoDataId)
        );
        if (assetData && !jobsMap.has(assetData.id)) {
          jobsMap.set(assetData.id, row.job as Job);
        }
      }
    }
  }

  // 回退：查询通过 assetId 关联的 jobs（迁移兼容）
  const assetsWithoutJobs = assetIds.filter((id) => !jobsMap.has(id));
  if (assetsWithoutJobs.length > 0) {
    const fallbackJobs = await db
      .select({
        assetId: job.assetId,
        job: job,
        rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${job.assetId} ORDER BY ${job.createdAt} DESC)`,
      })
      .from(job)
      .where(
        and(
          inArray(job.assetId, assetsWithoutJobs),
          inArray(job.type, ['asset_image_generation', 'video_generation', 'audio_generation'])
        )
      );

    for (const row of fallbackJobs) {
      if (row.rn === 1 && row.assetId && !jobsMap.has(row.assetId)) {
        jobsMap.set(row.assetId, row.job as Job);
      }
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
