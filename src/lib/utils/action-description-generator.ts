/**
 * Agent 操作描述生成器
 * 根据函数名和参数生成用户友好的操作描述
 */

import type { FunctionCall } from "@/types/agent";

export type TranslationFunction = (
  key: string,
  params?: Record<string, string | number>
) => string;

/**
 * 生成用户友好的操作描述
 */
export function generateActionDescription(
  functionCall: FunctionCall,
  t?: TranslationFunction
): string {
  const { name, parameters } = functionCall;

  // Default translation function (returns key or English fallback)
  const translate = t || ((key: string, params?: Record<string, string | number>) => {
    // Fallback to English
    const fallbacks: Record<string, string> = {
      "queryProjectContext": "Query project context",
      "queryImageAssets": "Query image assets",
      "queryVideoAssets": "Query video assets",
      "queryAssets": "Query assets",
      "queryAssetsWithTags": params?.tags ? `Tags: ${params.tags}` : "Filter by tags",
      "generateImageAsset": "Generate image asset",
      "generateImageAssetWithName": params?.name ? `Generate image asset - ${params.name}` : "Generate image asset",
      "generateImageAssets": params?.count !== undefined ? `Generate ${params.count} image assets` : "Generate image assets",
      "generateVideoAsset": "Generate video asset",
      "generateVideoAssetWithTitle": params?.title ? `Generate video asset - ${params.title}` : "Generate video asset",
      "updateAsset": "Update asset",
      "updateAssetWithName": params?.name ? `Update asset - ${params.name}` : "Update asset",
      "updateAssets": params?.count !== undefined ? `Update ${params.count} assets` : "Update assets",
      "setProjectInfo": "Set project info",
      "setProjectFields": params?.fields ? `Set project ${params.fields}` : "Set project info",
      "fieldTitle": "title",
      "fieldDescription": "description",
      "fieldStyle": "style",
      "deleteAsset": "Delete asset",
      "deleteAssets": params?.count !== undefined ? `Delete ${params.count} assets` : "Delete assets",
    };
    return fallbacks[key] || key;
  });

  try {
    switch (name) {
      // ============================================
      // 查询类操作
      // ============================================
      case "query_context":
        return translate("queryProjectContext");

      case "query_assets": {
        const parts: string[] = [];
        if (parameters.assetType === "image") {
          parts.push(translate("queryImageAssets"));
        } else if (parameters.assetType === "video") {
          parts.push(translate("queryVideoAssets"));
        } else {
          parts.push(translate("queryAssets"));
        }
        if (parameters.tags) {
          const tags = Array.isArray(parameters.tags) ? parameters.tags.join(",") : String(parameters.tags);
          parts.push(translate("queryAssetsWithTags", { tags }));
        }
        return parts.join(" - ");
      }

      // ============================================
      // 创作类操作
      // ============================================

      case "generate_image_asset": {
        const assets = parameters.assets as Array<{ name?: string; prompt?: string }>;
        const count = assets?.length || 0;
        if (count === 1 && assets[0]) {
          if (assets[0].name) {
            return translate("generateImageAssetWithName", { name: assets[0].name });
          }
          return translate("generateImageAsset");
        }
        return count > 0
          ? translate("generateImageAssets", { count })
          : translate("generateImageAsset");
      }

      case "generate_video_asset": {
        const title = parameters.title as string | undefined;
        if (title) {
          return translate("generateVideoAssetWithTitle", { title });
        }
        return translate("generateVideoAsset");
      }

      // ============================================
      // 修改类操作
      // ============================================
      case "update_asset": {
        const updates = parameters.updates as Array<{ assetId: string; name?: string }>;
        const count = updates?.length || 0;
        if (count === 1 && updates[0] && updates[0].name) {
          return translate("updateAssetWithName", { name: updates[0].name });
        }
        return count > 0
          ? translate("updateAssets", { count })
          : translate("updateAsset");
      }

      case "set_project_info": {
        const params = parameters as {
          title?: string;
          description?: string;
          stylePrompt?: string;
          styleId?: string;
        };
        const fields: string[] = [];
        if (params.title) fields.push(translate("fieldTitle"));
        if (params.description) fields.push(translate("fieldDescription"));
        if (params.stylePrompt || params.styleId) fields.push(translate("fieldStyle"));
        return fields.length > 0
          ? translate("setProjectFields", { fields: fields.join(", ") })
          : translate("setProjectInfo");
      }

      // ============================================
      // 删除类操作
      // ============================================
      case "delete_asset": {
        const assetIds = parameters.assetIds as string[];
        const count = assetIds?.length || 0;
        return count > 0
          ? translate("deleteAssets", { count })
          : translate("deleteAsset");
      }

      default:
        return functionCall.displayName || name;
    }
  } catch (error) {
    console.error("Failed to generate action description:", error);
    return functionCall.displayName || name;
  }
}
