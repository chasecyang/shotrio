/**
 * Asset查询的通用辅助函数
 * 
 * 提供JOIN job表并计算运行时状态的通用查询逻辑
 * 供各种asset查询函数复用
 */

import db from "@/lib/db";
import { asset, assetTag, job } from "@/lib/db/schemas/project";
import { eq, and, inArray, sql, SQL, desc } from "drizzle-orm";
import { enrichAssetWithStatus, enrichAssetsWithStatus } from "@/lib/utils/asset-status";
import type { Asset, AssetWithRuntimeStatus, AssetTag } from "@/types/asset";
import type { Job } from "@/types/job";

/**
 * 查询单个资产并附加运行时状态
 * 
 * 此函数会自动JOIN关联的job表，并计算资产的运行时状态（runtimeStatus）
 * 
 * 使用场景：
 * - 需要显示资产的生成状态（pending/processing/completed/failed）
 * - 需要获取资产的错误信息（从关联的job获取）
 * - 需要访问关联的job信息（latestJob字段）
 * 
 * 状态计算规则：
 * - 上传的资产（sourceType='uploaded'）：直接返回 'completed'
 * - 生成的资产（sourceType='generated'）：
 *   - 有关联job：从job.status映射（pending/processing/completed/failed/cancelled）
 *   - 无job但有文件URL：视为 'completed'
 *   - 无job且无文件：视为 'failed'（孤立资产）
 * 
 * 注意：此函数不进行权限验证，需要调用方自行验证
 * 
 * @param assetId - 资产ID
 * @returns 带运行时状态的资产，如果不存在返回null
 */
export async function getAssetWithStatus(
  assetId: string
): Promise<AssetWithRuntimeStatus | null> {
  // 查询asset及其tags
  const assetData = await db.query.asset.findFirst({
    where: eq(asset.id, assetId),
    with: {
      tags: true,
    },
  });

  if (!assetData) {
    return null;
  }

  // 查询最新的关联job（使用外键）
  const latestJob = await db.query.job.findFirst({
    where: and(
      eq(job.assetId, assetId),
      inArray(job.type, ['asset_image_generation', 'video_generation'])
    ),
    orderBy: [desc(job.createdAt)],
  });

  return enrichAssetWithStatus(
    assetData as Asset,
    assetData.tags as AssetTag[],
    latestJob as Job | undefined
  );
}

/**
 * 查询多个资产并附加运行时状态
 * 
 * 这是通用的查询函数，接受where条件和排序选项
 * 自动JOIN job表并计算运行时状态
 * 
 * @param whereClause - WHERE条件（可选）
 * @param orderByClause - 排序条件（可选）
 * @param limit - 限制返回数量（可选）
 * @param offset - 偏移量（可选）
 * @returns 带运行时状态的资产数组
 */
export async function queryAssetsWithStatus(
  whereClause?: SQL | undefined,
  orderByClause?: SQL | SQL[],
  limit?: number,
  offset?: number
): Promise<AssetWithRuntimeStatus[]> {
  // 1. 查询assets及其tags
  const assetsData = await db.query.asset.findMany({
    where: whereClause,
    with: {
      tags: true,
    },
    orderBy: orderByClause,
    limit,
    offset,
  });

  if (assetsData.length === 0) {
    return [];
  }

  // 2. 提取所有assetId
  const assetIds = assetsData.map((a) => a.id);

  // 3. 批量查询所有关联的jobs（使用外键）
  // 使用子查询获取每个asset的最新job
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
        inArray(job.type, ['asset_image_generation', 'video_generation'])
      )
    );

  // 4. 过滤出每个asset的最新job（rn = 1）
  const latestJobs = jobsData.filter((row) => row.rn === 1);

  // 5. 构建jobsMap (assetId -> Job)
  const jobsMap = new Map<string, Job>();
  for (const row of latestJobs) {
    if (row.assetId) {
      jobsMap.set(row.assetId, row.job as Job);
    }
  }

  // 6. 为所有assets附加运行时状态
  return enrichAssetsWithStatus(
    assetsData as Array<Asset & { tags: AssetTag[] }>,
    jobsMap
  );
}

/**
 * 统计资产数量（按状态分组）
 * 
 * @param projectId - 项目ID
 * @returns 各状态的资产数量
 */
export async function countAssetsByStatus(projectId: string): Promise<{
  total: number;
  completed: number;
  pending: number;
  processing: number;
  failed: number;
}> {
  // 获取所有资产及其状态
  const assetsWithStatus = await queryAssetsWithStatus(
    eq(asset.projectId, projectId)
  );

  // 统计各状态数量
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

/**
 * 查询指定项目的资产（带过滤和分页）
 * 
 * @param options - 查询选项
 * @returns 带运行时状态的资产数组
 */
export async function queryProjectAssetsWithStatus(options: {
  projectId: string;
  assetType?: "image" | "video";
  sourceType?: "generated" | "uploaded";
  tagFilters?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<AssetWithRuntimeStatus[]> {
  const {
    projectId,
    assetType,
    sourceType,
    tagFilters,
    search,
    limit,
    offset,
  } = options;

  // 构建WHERE条件
  const conditions: SQL[] = [eq(asset.projectId, projectId)];

  if (assetType) {
    conditions.push(eq(asset.assetType, assetType));
  }

  if (sourceType) {
    conditions.push(eq(asset.sourceType, sourceType));
  }

  if (search) {
    conditions.push(
      sql`${asset.name} ILIKE ${`%${search}%`}`
    );
  }

  // 如果有标签过滤，需要JOIN assetTag表
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

  const whereClause = and(...conditions);

  // 排序：按创建时间降序
  const orderByClause = desc(asset.createdAt);

  return queryAssetsWithStatus(whereClause, orderByClause, limit, offset);
}

