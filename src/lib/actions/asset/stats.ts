import type { AssetWithTags } from "@/types/asset";

/**
 * 统计素材类型分布
 * 纯工具函数，不需要 "use server"
 */
export function analyzeAssetsByType(assets: AssetWithTags[]) {
  const stats = {
    byType: {} as Record<string, number>,
    withoutImage: 0,
  };

  assets.forEach((asset) => {
    const tags = asset.tags.map((t) => t.tagValue);
    if (tags.includes("character")) {
      stats.byType.character = (stats.byType.character || 0) + 1;
    } else if (tags.includes("scene")) {
      stats.byType.scene = (stats.byType.scene || 0) + 1;
    } else if (tags.includes("prop")) {
      stats.byType.prop = (stats.byType.prop || 0) + 1;
    } else {
      stats.byType.other = (stats.byType.other || 0) + 1;
    }

    if (!asset.imageUrl) {
      stats.withoutImage++;
    }
  });

  return stats;
}

