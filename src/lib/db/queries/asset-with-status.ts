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

  // 收集所有版本 ID
  const allVersionIds = [
    ...(assetData.imageDataList?.map((v: any) => v.id) || []),
    ...(assetData.videoDataList?.map((v: any) => v.id) || []),
  ];

  // 查询所有版本的 jobs
  const allJobsMap = new Map<string, Job>();

  if (allVersionIds.length > 0) {
    // 查询所有版本关联的 jobs
    const versionJobs = await db.query.job.findMany({
      where: sql`(${job.imageDataId} IN (${sql.join(allVersionIds.map(id => sql`${id}`), sql`, `)}) OR ${job.videoDataId} IN (${sql.join(allVersionIds.map(id => sql`${id}`), sql`, `)}))`,
      orderBy: [desc(job.createdAt)],
    });

    // 为每个版本保存最新的 job
    for (const versionJob of versionJobs) {
      const versionId = versionJob.imageDataId || versionJob.videoDataId;
      if (versionId && !allJobsMap.has(versionId)) {
        allJobsMap.set(versionId, versionJob as Job);
      }
    }
  }

  // 获取激活版本的 job
  let latestJob: Job | null = null;
  if (activeImageData?.id && allJobsMap.has(activeImageData.id)) {
    latestJob = allJobsMap.get(activeImageData.id)!;
  } else if (activeVideoData?.id && allJobsMap.has(activeVideoData.id)) {
    latestJob = allJobsMap.get(activeVideoData.id)!;
  }

  // 如果新关联没找到，回退到旧的 assetId 关联（迁移兼容）
  if (!latestJob) {
    latestJob = await db.query.job.findFirst({
      where: and(
        eq(job.assetId, assetId),
        inArray(job.type, ['asset_image', 'asset_video', 'asset_audio'])
      ),
      orderBy: [desc(job.createdAt)],
    }) as Job | null;
  }

  // 查找其他正在生成的版本
  let otherGeneratingJob: Job | null = null;
  for (const versionId of allVersionIds) {
    // 跳过激活版本
    if (versionId === activeImageData?.id || versionId === activeVideoData?.id) continue;

    const versionJob = allJobsMap.get(versionId);
    if (versionJob && (versionJob.status === 'pending' || versionJob.status === 'processing')) {
      otherGeneratingJob = versionJob;
      break; // 只需要第一个正在生成的版本
    }
  }

  return enrichAssetWithFullData(
    assetData as Asset,
    assetData.tags as AssetTagType[],
    assetData.imageDataList ?? [],
    assetData.videoDataList ?? [],
    assetData.textData,
    assetData.audioData,
    latestJob,
    otherGeneratingJob
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

  // 收集所有版本 ID 和激活版本 ID
  const allImageDataIds: string[] = [];
  const allVideoDataIds: string[] = [];
  const activeImageDataMap = new Map<string, string>(); // assetId -> activeImageDataId
  const activeVideoDataMap = new Map<string, string>(); // assetId -> activeVideoDataId
  const assetIds = assetsData.map((a) => a.id);

  for (const assetData of assetsData) {
    const activeImageData = assetData.imageDataList?.find((v: any) => v.isActive);
    const activeVideoData = assetData.videoDataList?.find((v: any) => v.isActive);

    // 记录激活版本
    if (activeImageData?.id) activeImageDataMap.set(assetData.id, activeImageData.id);
    if (activeVideoData?.id) activeVideoDataMap.set(assetData.id, activeVideoData.id);

    // 收集所有版本 ID
    assetData.imageDataList?.forEach((v: any) => allImageDataIds.push(v.id));
    assetData.videoDataList?.forEach((v: any) => allVideoDataIds.push(v.id));
  }

  // 批量查询所有关联的 jobs（所有版本，不仅仅是激活版本）
  const allJobsMap = new Map<string, Job>(); // versionId -> latest job
  const activeJobsMap = new Map<string, Job>(); // assetId -> active version's job
  const otherGeneratingJobsMap = new Map<string, Job>(); // assetId -> other generating job

  // 查询所有图片版本关联的 jobs
  if (allImageDataIds.length > 0) {
    const imageJobs = await db
      .select({
        imageDataId: job.imageDataId,
        job: job,
        rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${job.imageDataId} ORDER BY ${job.createdAt} DESC)`,
      })
      .from(job)
      .where(inArray(job.imageDataId, allImageDataIds));

    for (const row of imageJobs) {
      if (Number(row.rn) === 1 && row.imageDataId) {
        allJobsMap.set(row.imageDataId, row.job as Job);
      }
    }
  }

  // 查询所有视频版本关联的 jobs
  if (allVideoDataIds.length > 0) {
    const videoJobs = await db
      .select({
        videoDataId: job.videoDataId,
        job: job,
        rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${job.videoDataId} ORDER BY ${job.createdAt} DESC)`,
      })
      .from(job)
      .where(inArray(job.videoDataId, allVideoDataIds));

    for (const row of videoJobs) {
      if (Number(row.rn) === 1 && row.videoDataId) {
        allJobsMap.set(row.videoDataId, row.job as Job);
      }
    }
  }

  // 分配 jobs 到激活版本和其他生成中的版本
  for (const assetData of assetsData) {
    const activeImageId = activeImageDataMap.get(assetData.id);
    const activeVideoId = activeVideoDataMap.get(assetData.id);

    // 获取激活版本的 job
    if (activeImageId && allJobsMap.has(activeImageId)) {
      activeJobsMap.set(assetData.id, allJobsMap.get(activeImageId)!);
    } else if (activeVideoId && allJobsMap.has(activeVideoId)) {
      activeJobsMap.set(assetData.id, allJobsMap.get(activeVideoId)!);
    }

    // 检查非激活版本中是否有正在生成的
    const allVersionIds = [
      ...(assetData.imageDataList?.map((v: any) => v.id) || []),
      ...(assetData.videoDataList?.map((v: any) => v.id) || []),
    ];

    for (const versionId of allVersionIds) {
      // 跳过激活版本
      if (versionId === activeImageId || versionId === activeVideoId) continue;

      const versionJob = allJobsMap.get(versionId);
      if (versionJob && (versionJob.status === 'pending' || versionJob.status === 'processing')) {
        otherGeneratingJobsMap.set(assetData.id, versionJob);
        break; // 只需要第一个正在生成的版本
      }
    }
  }

  // 回退：查询通过 assetId 关联的 jobs（迁移兼容）
  const assetsWithoutJobs = assetIds.filter((id) => !activeJobsMap.has(id));
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
          inArray(job.type, ['asset_image', 'asset_video', 'asset_audio'])
        )
      );

    for (const row of fallbackJobs) {
      if (Number(row.rn) === 1 && row.assetId && !activeJobsMap.has(row.assetId)) {
        activeJobsMap.set(row.assetId, row.job as Job);
      }
    }
  }

  return enrichAssetsWithFullData(assetsData as any, activeJobsMap, otherGeneratingJobsMap);
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
