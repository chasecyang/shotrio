"use server";

import db from "@/lib/db";
import { exampleAsset } from "@/lib/db/schemas/project";
import { desc } from "drizzle-orm";

/**
 * 示例资产预览（用于首页）
 */
export interface ExampleAssetPreview {
  assetId: string;
  assetName: string;
  assetType: "image" | "video";
  imageUrl: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  displayName: string | null;
  description: string | null;
  aspectRatio: string | null; // e.g., "16:9", "9:16", "1:1"
}

/**
 * 获取公开示例资产（用于首页瀑布流）
 * 无需认证
 */
export async function getPublicExampleAssets(options?: {
  limit?: number;
  offset?: number;
}): Promise<{
  examples: ExampleAssetPreview[];
  total: number;
}> {
  try {
    // 获取总数
    const allExamples = await db.query.exampleAsset.findMany();
    const total = allExamples.length;

    // 获取分页数据
    const examples = await db.query.exampleAsset.findMany({
      orderBy: [desc(exampleAsset.order), desc(exampleAsset.createdAt)],
      limit: options?.limit ?? 12,
      offset: options?.offset ?? 0,
      with: {
        asset: {
          with: {
            imageDataList: true,
            videoDataList: true,
          },
        },
      },
    });

    const results: ExampleAssetPreview[] = [];

    for (const ex of examples) {
      const assetData = ex.asset as any;

      const activeImage = assetData.imageDataList?.find((v: any) => v.isActive);
      const activeVideo = assetData.videoDataList?.find((v: any) => v.isActive);

      // 跳过没有活动版本的资产
      if (!activeImage && !activeVideo) continue;

      // 解析宽高比
      let aspectRatio: string | null = null;
      if (activeImage?.generationConfig) {
        try {
          const config = JSON.parse(activeImage.generationConfig);
          // 图片使用 aspectRatio（驼峰命名）
          aspectRatio = config.aspectRatio ?? null;
        } catch {}
      } else if (activeVideo?.generationConfig) {
        try {
          const config = JSON.parse(activeVideo.generationConfig);
          // 视频使用 aspect_ratio（下划线命名）
          aspectRatio = config.aspect_ratio ?? config.aspectRatio ?? null;
        } catch {}
      }

      results.push({
        assetId: ex.assetId,
        assetName: assetData.name,
        assetType: assetData.assetType,
        imageUrl: activeImage?.imageUrl ?? null,
        videoUrl: activeVideo?.videoUrl ?? null,
        thumbnailUrl: activeImage?.thumbnailUrl ?? activeVideo?.thumbnailUrl ?? null,
        displayName: ex.displayName,
        description: ex.description,
        aspectRatio,
      });
    }

    return {
      examples: results,
      total,
    };
  } catch (error) {
    console.error("获取示例资产失败:", error);
    return {
      examples: [],
      total: 0,
    };
  }
}

/**
 * 加载更多示例资产
 */
export async function loadMoreExamples(
  offset: number,
  limit: number = 12
): Promise<ExampleAssetPreview[]> {
  const result = await getPublicExampleAssets({ limit, offset });
  return result.examples;
}
