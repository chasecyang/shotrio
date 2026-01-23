/**
 * 依赖检查工具
 * 用于检查任务依赖的图片资源是否已经生成完成
 */

import db from "@/lib/db";
import { imageData } from "@/lib/db/schemas/project";
import { inArray } from "drizzle-orm";

export interface DependencyCheckResult {
  ready: boolean;
  waitingFor?: Array<{
    assetId: string;
    imageDataId: string;
  }>;
  failedDependencies?: Array<{
    assetId: string;
    reason: string;
  }>;
}

/**
 * 检查图片依赖是否就绪
 * @param imageDataIds - 需要检查的 imageData ID 列表
 * @returns 依赖检查结果
 */
export async function checkImageDependencies(
  imageDataIds: string[]
): Promise<DependencyCheckResult> {
  if (!imageDataIds || imageDataIds.length === 0) {
    return { ready: true };
  }

  try {
    // 查询所有依赖的 imageData 记录
    const imageDataRecords = await db.query.imageData.findMany({
      where: inArray(imageData.id, imageDataIds),
      columns: {
        id: true,
        imageUrl: true,
        assetId: true,
      },
    });

    const waitingFor: Array<{ assetId: string; imageDataId: string }> = [];
    const failedDependencies: Array<{ assetId: string; reason: string }> = [];

    // 检查每个依赖
    for (const imageDataId of imageDataIds) {
      const record = imageDataRecords.find((r) => r.id === imageDataId);

      if (!record) {
        // 依赖不存在（可能被删除）
        failedDependencies.push({
          assetId: "",
          reason: `图片版本 ${imageDataId} 不存在或已被删除`,
        });
        continue;
      }

      if (!record.imageUrl) {
        // 图片还在生成中（imageUrl 为 null）
        waitingFor.push({
          assetId: record.assetId,
          imageDataId: record.id,
        });
      }
    }

    // 如果有失败的依赖，立即返回失败
    if (failedDependencies.length > 0) {
      return {
        ready: false,
        failedDependencies,
      };
    }

    // 如果有等待中的依赖，返回等待状态
    if (waitingFor.length > 0) {
      return {
        ready: false,
        waitingFor,
      };
    }

    // 所有依赖都已就绪
    return { ready: true };
  } catch (error) {
    console.error("[DependencyChecker] 检查依赖失败:", error);
    throw error;
  }
}

/**
 * 从版本快照中提取依赖的 imageDataId 列表
 * @param versionSnapshot - 版本快照对象
 * @returns imageDataId 列表
 */
export function extractDependenciesFromSnapshot(versionSnapshot?: {
  start_image_version_id?: string;
  end_image_version_id?: string;
  source_image_version_ids?: string[];
}): string[] {
  if (!versionSnapshot) {
    return [];
  }

  const dependencies: string[] = [];

  if (versionSnapshot.start_image_version_id) {
    dependencies.push(versionSnapshot.start_image_version_id);
  }

  if (versionSnapshot.end_image_version_id) {
    dependencies.push(versionSnapshot.end_image_version_id);
  }

  if (versionSnapshot.source_image_version_ids) {
    dependencies.push(...versionSnapshot.source_image_version_ids);
  }

  return dependencies;
}
