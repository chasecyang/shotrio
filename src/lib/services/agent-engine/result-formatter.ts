/**
 * Agent Engine 函数结果格式化
 */

export type TranslationFunction = (
  key: string,
  params?: Record<string, string | number>
) => string;

/**
 * 格式化函数执行结果，生成用户友好的描述
 */
export function formatFunctionResult(
  functionName: string,
  parameters: Record<string, unknown>,
  data: unknown,
  t?: TranslationFunction
): string | undefined {
  if (!data) return undefined;

  // Default translation function (returns key or fallback)
  const translate = t || ((key: string, params?: Record<string, string | number>) => {
    // Fallback to English
    const fallbacks: Record<string, string> = {
      "queriedContext": params?.parts ? `Queried: ${params.parts}` : "Queried project context",
      "queriedProjectContext": "Queried project context",
      "projectInfo": "project info",
      "episode": "episode",
      "videos": params?.count !== undefined ? `videos(${params.count})` : "videos",
      "assets": params?.count !== undefined ? `assets(${params.count})` : "assets",
      "artStyles": "art styles",
      "foundAssets": params?.count !== undefined ? `Found ${params.count} assets` : "Found assets",
      "foundAssetsWithStatus": params?.total !== undefined
        ? `Found ${params.total} assets (${params.completed} completed, ${params.processing} processing${params.failed ? `, ${params.failed} failed` : ""})`
        : "Found assets",
      "emptyAssetLibrary": "Asset library is empty",
      "foundTextAssets": params?.count !== undefined ? `Found ${params.count} text assets` : "Found text assets",
      "noTextAssetsFound": "No text assets found",
      "foundCuts": params?.count !== undefined ? `Found ${params.count} cuts` : "Found cuts",
      "noCutsFound": "No cuts found, use create_cut to create one",
      "cutEmpty": "Cut is empty, no clips",
      "cutSummary": params?.clipCount !== undefined
        ? `Cut has ${params.clipCount} clips (${params.videoClips} video, ${params.audioClips} audio), duration ${params.duration}s`
        : "Cut summary",
      "queryComplete": "Query complete",
      "createdVideoWithTitle": params?.title ? `Created video: ${params.title}` : "Created video",
      "createdVideoTask": "Created video generation task",
      "createdImageTasks": params?.count !== undefined ? `Created ${params.count} generation tasks` : "Created generation tasks",
      "createdImageTask": "Created image generation task",
      "createdTextAsset": params?.name ? `Created text asset "${params.name}"` : "Created text asset",
      "createdCut": params?.title ? `Created cut: ${params.title}` : "Created cut",
      "deletedCut": "Cut deleted",
      "updatedAssets": params?.count !== undefined ? `Updated ${params.count} assets` : "Updated assets",
      "updatedAsset": "Updated asset",
      "updatedProjectFields": params?.fields ? `Updated project ${params.fields}` : "Updated project info",
      "updatedProjectInfo": "Updated project info",
      "deletedAssets": params?.count !== undefined ? `Deleted ${params.count} assets` : "Deleted assets",
      "completedOperations": params?.count !== undefined ? `Completed ${params.count} operations` : "Completed operations",
      "totalItems": params?.count !== undefined ? `Total ${params.count} items` : "Total",
    };
    return fallbacks[key] || key;
  });

  try {
    switch (functionName) {
      // ============================================
      // Query functions
      // ============================================
      case "query_context": {
        const contextData = data as {
          projectInfo?: { title?: string; description?: string; currentStyle?: unknown };
          episode?: unknown;
          videos?: { total?: number; completed?: number; processing?: number; list?: unknown[] };
          assets?: { total?: number };
          artStyles?: unknown[]
        };
        const parts: string[] = [];
        if (contextData.projectInfo) parts.push(translate("projectInfo"));
        if (contextData.episode) parts.push(translate("episode"));
        if (contextData.videos) parts.push(translate("videos", { count: contextData.videos.total || 0 }));
        if (contextData.assets) parts.push(translate("assets", { count: contextData.assets.total || 0 }));
        if (contextData.artStyles) parts.push(translate("artStyles"));
        return parts.length > 0
          ? translate("queriedContext", { parts: parts.join(", ") })
          : translate("queriedProjectContext");
      }

      case "query_assets": {
        const queryData = data as {
          total?: number;
          completed?: number;
          processing?: number;
          failed?: number;
          assetType?: string;
          assets?: unknown[];
        };
        if (queryData.total === 0 || (queryData.assets && queryData.assets.length === 0)) {
          return translate("emptyAssetLibrary");
        }
        if (queryData.total !== undefined) {
          return translate("foundAssetsWithStatus", {
            total: queryData.total,
            completed: queryData.completed || 0,
            processing: queryData.processing || 0,
            failed: queryData.failed || 0,
          });
        }
        return translate("queryComplete");
      }

      case "query_text_assets": {
        const textData = data as { total?: number; assets?: unknown[] };
        if (textData.total === 0 || (textData.assets && textData.assets.length === 0)) {
          return translate("noTextAssetsFound");
        }
        return translate("foundTextAssets", { count: textData.total || textData.assets?.length || 0 });
      }

      case "query_cuts": {
        const cutsData = data as { total?: number; cuts?: unknown[] };
        if (cutsData.total === 0 || (cutsData.cuts && cutsData.cuts.length === 0)) {
          return translate("noCutsFound");
        }
        return translate("foundCuts", { count: cutsData.total || cutsData.cuts?.length || 0 });
      }

      case "query_cut": {
        const cutData = data as {
          cut?: { clipCount?: number };
          summary?: { videoClips?: number; audioClips?: number; totalDurationSec?: number };
        };
        if (cutData.cut?.clipCount === 0) {
          return translate("cutEmpty");
        }
        if (cutData.summary) {
          return translate("cutSummary", {
            clipCount: cutData.cut?.clipCount || 0,
            videoClips: cutData.summary.videoClips || 0,
            audioClips: cutData.summary.audioClips || 0,
            duration: cutData.summary.totalDurationSec || 0,
          });
        }
        return translate("queryComplete");
      }

      // ============================================
      // Generation functions
      // ============================================
      case "generate_video_asset": {
        const videoData = data as { videoId?: string; title?: string };
        if (videoData.title) {
          return translate("createdVideoWithTitle", { title: videoData.title });
        }
        return translate("createdVideoTask");
      }

      case "generate_image_asset": {
        const batchData = data as { createdCount?: number; assetIds?: string[]; totalCount?: number };
        if (batchData.createdCount !== undefined) {
          return translate("createdImageTasks", { count: batchData.createdCount });
        }
        if (batchData.assetIds) {
          return translate("createdImageTasks", { count: batchData.assetIds.length });
        }
        return translate("createdImageTask");
      }

      case "create_text_asset": {
        const textAssetData = data as { name?: string; assetId?: string };
        return translate("createdTextAsset", { name: textAssetData.name || "" });
      }

      case "create_cut": {
        const cutData = data as { cut?: { title?: string } };
        return translate("createdCut", { title: cutData.cut?.title || "" });
      }

      case "delete_cut": {
        return translate("deletedCut");
      }

      // ============================================
      // Modification functions
      // ============================================
      case "update_asset": {
        const updateData = data as { updated?: number; total?: number };
        if (updateData.updated !== undefined) {
          return translate("updatedAssets", { count: updateData.updated });
        }
        return translate("updatedAsset");
      }

      case "set_project_info": {
        const resultData = data as { updatedFields?: string[] };
        if (resultData.updatedFields && resultData.updatedFields.length > 0) {
          return translate("updatedProjectFields", { fields: resultData.updatedFields.join(", ") });
        }
        return translate("updatedProjectInfo");
      }

      // ============================================
      // Deletion functions
      // ============================================
      case "delete_asset": {
        const deleteData = data as { deleted?: number };
        const count = deleteData.deleted ?? (Array.isArray(parameters.assetIds) ? (parameters.assetIds as string[]).length : 1);
        return translate("deletedAssets", { count });
      }

      default:
        // For unknown functions, try to extract useful info from data
        if (typeof data === "object" && data !== null) {
          const dataObj = data as Record<string, unknown>;
          if (dataObj.count !== undefined) {
            return translate("completedOperations", { count: dataObj.count as number });
          }
          if (dataObj.total !== undefined) {
            return translate("totalItems", { count: dataObj.total as number });
          }
        }
        return undefined;
    }
  } catch (error) {
    console.warn(`[AgentEngine] Failed to format function result:`, error);
    return undefined;
  }
}
