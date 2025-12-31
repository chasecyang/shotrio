"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { asset, assetTag, project } from "@/lib/db/schemas/project";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import type {
  AssetQueryFilter,
  AssetQueryResult,
  AssetWithTags,
} from "@/types/asset";
import { getAssetStatus } from "@/types/asset";

/**
 * 查询资产列表（带标签筛选）
 */
export async function queryAssets(
  filter: AssetQueryFilter
): Promise<AssetQueryResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { assets: [], total: 0, hasMore: false };
  }

  try {
    // 验证项目权限
    const projectData = await db.query.project.findFirst({
      where: and(
        eq(project.id, filter.projectId),
        eq(project.userId, session.user.id)
      ),
    });

    if (!projectData) {
      return { assets: [], total: 0, hasMore: false };
    }

    const limit = filter.limit || 50;
    const offset = filter.offset || 0;

    // 构建查询条件
    const conditions = [eq(asset.projectId, filter.projectId)];

    // 资产类型筛选
    if (filter.assetType) {
      conditions.push(eq(asset.assetType, filter.assetType));
    }

    // 如果有标签筛选，需要使用子查询
    if (filter.tagFilters && filter.tagFilters.length > 0) {
      // 查找匹配所有标签的资产ID
      const matchingAssetIds = await db
        .selectDistinct({ assetId: assetTag.assetId })
        .from(assetTag)
        .where(inArray(assetTag.tagValue, filter.tagFilters))
        .groupBy(assetTag.assetId)
        .having(sql`COUNT(DISTINCT ${assetTag.tagValue}) = ${filter.tagFilters.length}`);

      if (matchingAssetIds.length > 0) {
        conditions.push(
          inArray(
            asset.id,
            matchingAssetIds.map(r => r.assetId)
          )
        );
      } else {
        // 没有匹配的资产
        return { assets: [], total: 0, hasMore: false };
      }
    }

    // 搜索名称
    if (filter.search) {
      conditions.push(sql`${asset.name} ILIKE ${`%${filter.search}%`}`);
    }

    // 按源资产筛选（查询包含指定源资产的派生资产）
    if (filter.sourceAssetIds && filter.sourceAssetIds.length > 0) {
      // 使用 SQL 的数组操作符检查是否包含任意一个源资产ID
      conditions.push(
        sql`${asset.sourceAssetIds} && ${filter.sourceAssetIds}`
      );
    }

    // 查询资产
    const assets = await db.query.asset.findMany({
      where: and(...conditions),
      with: {
        tags: true,
      },
      orderBy: [desc(asset.createdAt)],
      limit: limit + 1, // 多查一条判断是否还有更多
      offset,
    });

    const hasMore = assets.length > limit;
    const resultAssets = hasMore ? assets.slice(0, limit) : assets;

    // 为每个asset添加status字段
    const assetsWithStatus = resultAssets.map(asset => ({
      ...asset,
      status: getAssetStatus(asset),
    }));

    // 计算总数（简化版本，实际可能需要单独的count查询）
    const total = offset + resultAssets.length + (hasMore ? 1 : 0);

    return {
      assets: assetsWithStatus as AssetWithTags[],
      total,
      hasMore,
    };
  } catch (error) {
    console.error("查询资产失败:", error);
    return { assets: [], total: 0, hasMore: false };
  }
}

/**
 * 获取项目的所有资产（不分页，用于选择器等场景）
 */
export async function getProjectAssets(filter: {
  projectId: string;
  assetType?: "image" | "video"; // 新增类型过滤
  tagFilters?: string[];
  orderBy?: "created" | "order";
}): Promise<AssetWithTags[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return [];
  }

  try {
    // 验证项目权限
    const projectData = await db.query.project.findFirst({
      where: and(
        eq(project.id, filter.projectId),
        eq(project.userId, session.user.id)
      ),
    });

    if (!projectData) {
      return [];
    }

    // 构建查询条件
    const conditions = [eq(asset.projectId, filter.projectId)];
    
    if (filter.assetType) {
      conditions.push(eq(asset.assetType, filter.assetType));
    }

    // 标签筛选
    if (filter.tagFilters && filter.tagFilters.length > 0) {
      const matchingAssetIds = await db
        .selectDistinct({ assetId: assetTag.assetId })
        .from(assetTag)
        .where(inArray(assetTag.tagValue, filter.tagFilters))
        .groupBy(assetTag.assetId)
        .having(sql`COUNT(DISTINCT ${assetTag.tagValue}) = ${filter.tagFilters.length}`);

      if (matchingAssetIds.length > 0) {
        conditions.push(
          inArray(
            asset.id,
            matchingAssetIds.map(r => r.assetId)
          )
        );
      } else {
        return [];
      }
    }

    // 排序
    const orderBy = filter.orderBy === "order" 
      ? [asset.order, desc(asset.createdAt)]
      : [desc(asset.createdAt)];

    const assets = await db.query.asset.findMany({
      where: and(...conditions),
      with: {
        tags: true,
      },
      orderBy,
    });

    // 为每个asset添加status字段
    const assetsWithStatus = assets.map(asset => ({
      ...asset,
      status: getAssetStatus(asset),
    }));

    return assetsWithStatus as AssetWithTags[];
  } catch (error) {
    console.error("获取项目资产失败:", error);
    return [];
  }
}

/**
 * 按标签值查询资产
 */
export async function getAssetsByTag(
  projectId: string,
  tagValue: string
): Promise<AssetWithTags[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return [];
  }

  try {
    // 验证项目权限
    const projectData = await db.query.project.findFirst({
      where: and(
        eq(project.id, projectId),
        eq(project.userId, session.user.id)
      ),
    });

    if (!projectData) {
      return [];
    }

    // 查找匹配标签的资产ID
    const matchingTags = await db.query.assetTag.findMany({
      where: eq(assetTag.tagValue, tagValue),
    });

    if (matchingTags.length === 0) {
      return [];
    }

    const assetIds = [...new Set(matchingTags.map(t => t.assetId))];

    // 获取资产详情
    const assets = await db.query.asset.findMany({
      where: and(
        eq(asset.projectId, projectId),
        inArray(asset.id, assetIds)
      ),
      with: {
        tags: true,
      },
      orderBy: [desc(asset.createdAt)],
    });

    // 为每个asset添加status字段
    const assetsWithStatus = assets.map(asset => ({
      ...asset,
      status: getAssetStatus(asset),
    }));

    return assetsWithStatus as AssetWithTags[];
  } catch (error) {
    console.error("按标签查询资产失败:", error);
    return [];
  }
}

/**
 * 获取资产的派生树（该资产派生出的所有资产）
 */
export async function getAssetDerivations(
  assetId: string
): Promise<AssetWithTags[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return [];
  }

  try {
    // 查询 sourceAssetIds 数组中包含指定 assetId 的派生资产
    const derivedAssets = await db.query.asset.findMany({
      where: sql`${asset.sourceAssetIds} @> ARRAY[${assetId}]::text[]`,
      with: {
        tags: true,
      },
      orderBy: [desc(asset.createdAt)],
    });

    // 为每个asset添加status字段
    const assetsWithStatus = derivedAssets.map(asset => ({
      ...asset,
      status: getAssetStatus(asset),
    }));

    return assetsWithStatus as AssetWithTags[];
  } catch (error) {
    console.error("获取派生资产失败:", error);
    return [];
  }
}

