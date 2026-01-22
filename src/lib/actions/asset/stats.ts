"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { asset, assetTag, project } from "@/lib/db/schemas/project";
import { eq, and, sql } from "drizzle-orm";
import type { AssetWithFullData } from "@/types/asset";

/**
 * 统计素材类型分布
 * 按媒体类型（image/video/text/audio）分类
 */
export async function analyzeAssetsByType(assets: AssetWithFullData[]) {
  const stats = {
    byType: {} as Record<string, number>,
  };

  assets.forEach((asset) => {
    const type = asset.assetType; // image | video | text | audio
    stats.byType[type] = (stats.byType[type] || 0) + 1;
  });

  return stats;
}

/**
 * 获取项目中最常用的标签（前10个）
 * @param projectId 项目ID
 * @returns 标签统计数组，按使用次数降序排列
 */
export async function getTopTagStats(projectId: string): Promise<Array<{
  tagValue: string;
  count: number;
}>> {
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

    // 查询该项目所有素材的标签统计
    const tagStats = await db
      .select({
        tagValue: assetTag.tagValue,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(assetTag)
      .innerJoin(asset, eq(assetTag.assetId, asset.id))
      .where(eq(asset.projectId, projectId))
      .groupBy(assetTag.tagValue)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10);

    return tagStats;
  } catch (error) {
    console.error("获取标签统计失败:", error);
    return [];
  }
}

