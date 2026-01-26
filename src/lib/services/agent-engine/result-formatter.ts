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
    // Fallback to Chinese for backward compatibility
    const fallbacks: Record<string, string> = {
      "queriedContext": params?.parts ? `已查询: ${params.parts}` : "已查询项目上下文",
      "queriedProjectContext": "已查询项目上下文",
      "projectInfo": "项目信息",
      "episode": "剧集",
      "videos": params?.count !== undefined ? `视频(${params.count})` : "视频",
      "assets": params?.count !== undefined ? `素材(${params.count})` : "素材",
      "artStyles": "美术风格列表",
      "foundAssets": params?.count !== undefined ? `找到 ${params.count} 个资产` : "找到资产",
      "queryComplete": "查询完成",
      "createdVideoWithTitle": params?.title ? `已创建视频: ${params.title}` : "已创建视频",
      "createdVideoTask": "已创建视频生成任务",
      "createdImageTasks": params?.count !== undefined ? `已创建 ${params.count} 个生成任务` : "已创建生成任务",
      "createdImageTask": "已创建图片生成任务",
      "updatedAssets": params?.count !== undefined ? `已更新 ${params.count} 个资产` : "已更新资产",
      "updatedAsset": "已更新资产",
      "updatedProjectFields": params?.fields ? `已更新项目${params.fields}` : "已更新项目信息",
      "updatedProjectInfo": "已更新项目信息",
      "deletedAssets": params?.count !== undefined ? `已删除 ${params.count} 个资产` : "已删除资产",
      "completedOperations": params?.count !== undefined ? `已完成 ${params.count} 项操作` : "已完成操作",
      "totalItems": params?.count !== undefined ? `共 ${params.count} 项` : "共计",
    };
    return fallbacks[key] || key;
  });

  try {
    switch (functionName) {
      // ============================================
      // 查询类
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
        const queryData = data as { total?: number; message?: string };
        if (queryData.message) {
          return queryData.message;
        }
        if (queryData.total !== undefined) {
          return translate("foundAssets", { count: queryData.total });
        }
        return translate("queryComplete");
      }

      // ============================================
      // 创作类
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

      // ============================================
      // 修改类
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
      // 删除类
      // ============================================
      case "delete_asset": {
        const deleteData = data as { deleted?: number };
        const count = deleteData.deleted ?? (Array.isArray(parameters.assetIds) ? (parameters.assetIds as string[]).length : 1);
        return translate("deletedAssets", { count });
      }

      default:
        // 对于未知函数，尝试从 data 中提取有用信息
        if (typeof data === "object" && data !== null) {
          const dataObj = data as Record<string, unknown>;
          // 尝试提取常见的字段
          if (dataObj.message && typeof dataObj.message === "string") {
            return dataObj.message;
          }
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
    console.warn(`[AgentEngine] 格式化函数结果失败:`, error);
    return undefined;
  }
}
