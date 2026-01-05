"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { asset, generationInfo, project } from "@/lib/db/schemas/project";
import { eq, and, desc, sql } from "drizzle-orm";
import type {
  AssetTypeEnum,
  AssetQueryFilter,
  AssetQueryResult,
  AssetWithFullData,
} from "@/types/asset";
import { queryProjectAssets, queryAssetsWithFullData } from "@/lib/db/queries/asset-with-status";

/**
 * 查询资产列表（带标签筛选）
 * 使用 Drizzle relations 自动 join 扩展表并计算运行时状态
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

    // 使用新的查询函数
    const assets = await queryProjectAssets({
      projectId: filter.projectId,
      assetType: filter.assetType,
      tagFilters: filter.tagFilters,
      search: filter.search,
      limit: limit + 1, // 多查一条判断是否还有更多
      offset,
    });

    const hasMore = assets.length > limit;
    const resultAssets = hasMore ? assets.slice(0, limit) : assets;

    // 计算总数（简化版本，实际可能需要单独的count查询）
    const total = offset + resultAssets.length + (hasMore ? 1 : 0);

    return {
      assets: resultAssets,
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
 * 使用 Drizzle relations 自动 join 扩展表并计算运行时状态
 */
export async function getProjectAssets(filter: {
  projectId: string;
  assetType?: AssetTypeEnum;
  tagFilters?: string[];
  orderBy?: "created" | "order";
}): Promise<AssetWithFullData[]> {
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

    // 使用新的查询函数（不限制数量）
    const assets = await queryProjectAssets({
      projectId: filter.projectId,
      assetType: filter.assetType,
      tagFilters: filter.tagFilters,
    });

    return assets as AssetWithFullData[];
  } catch (error) {
    console.error("获取项目资产失败:", error);
    return [];
  }
}

/**
 * 按标签值查询资产
 * 使用 Drizzle relations 自动 join 扩展表并计算运行时状态
 */
export async function getAssetsByTag(
  projectId: string,
  tagValue: string
): Promise<AssetWithFullData[]> {
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

    // 使用新的查询函数，传入标签过滤
    const assets = await queryProjectAssets({
      projectId,
      tagFilters: [tagValue],
    });

    return assets as AssetWithFullData[];
  } catch (error) {
    console.error("按标签查询资产失败:", error);
    return [];
  }
}

/**
 * 获取资产的派生树（该资产派生出的所有资产）
 * 查询 generationInfo.sourceAssetIds 数组中包含指定 assetId 的派生资产
 */
export async function getAssetDerivations(
  assetId: string
): Promise<AssetWithFullData[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return [];
  }

  try {
    // 先查询 generationInfo 表找到所有派生资产的 ID
    const derivedGenInfos = await db.query.generationInfo.findMany({
      where: sql`${generationInfo.sourceAssetIds} @> ARRAY[${assetId}]::text[]`,
    });

    if (derivedGenInfos.length === 0) {
      return [];
    }

    const derivedAssetIds = derivedGenInfos.map((g) => g.assetId);

    // 使用新的查询函数获取完整资产数据
    const whereClause = sql`${asset.id} IN (${sql.join(
      derivedAssetIds.map((id) => sql`${id}`),
      sql`, `
    )})`;
    const orderByClause = desc(asset.createdAt);

    const derivedAssets = await queryAssetsWithFullData(whereClause, orderByClause);

    return derivedAssets;
  } catch (error) {
    console.error("获取派生资产失败:", error);
    return [];
  }
}
