/**
 * Agent Engine 函数结果格式化
 */

/**
 * 格式化函数执行结果，生成用户友好的描述
 */
export function formatFunctionResult(
  functionName: string,
  parameters: Record<string, unknown>,
  data: unknown
): string | undefined {
  if (!data) return undefined;

  try {
    switch (functionName) {
      // ============================================
      // 查询类
      // ============================================
      case "query_context": {
        const contextData = data as { episode?: unknown; videos?: unknown[]; assets?: { total?: number }; artStyles?: unknown[] };
        const parts: string[] = [];
        if (contextData.episode) parts.push("剧集");
        if (contextData.videos) parts.push(`视频(${contextData.videos.length})`);
        if (contextData.assets) parts.push(`素材(${contextData.assets.total || 0})`);
        if (contextData.artStyles) parts.push("美术风格");
        return parts.length > 0 ? `已查询: ${parts.join("、")}` : "已查询项目上下文";
      }

      case "query_assets": {
        const queryData = data as { total?: number; message?: string };
        if (queryData.message) {
          return queryData.message;
        }
        if (queryData.total !== undefined) {
          return `找到 ${queryData.total} 个资产`;
        }
        return "查询完成";
      }

      // ============================================
      // 创作类
      // ============================================
      case "generate_video_asset": {
        const videoData = data as { videoId?: string; title?: string };
        if (videoData.title) {
          return `已创建视频: ${videoData.title}`;
        }
        return "已创建视频生成任务";
      }

      case "generate_image_asset": {
        const batchData = data as { createdCount?: number; assetIds?: string[]; totalCount?: number };
        if (batchData.createdCount !== undefined) {
          return `已创建 ${batchData.createdCount} 个生成任务`;
        }
        if (batchData.assetIds) {
          return `已创建 ${batchData.assetIds.length} 个生成任务`;
        }
        return "已创建图片生成任务";
      }

      // ============================================
      // 修改类
      // ============================================
      case "update_asset": {
        const updateData = data as { updated?: number; total?: number };
        if (updateData.updated !== undefined) {
          return `已更新 ${updateData.updated} 个资产`;
        }
        return "已更新资产";
      }

      case "set_art_style": {
        return "已设置项目美术风格";
      }

      // ============================================
      // 删除类
      // ============================================
      case "delete_asset": {
        const deleteData = data as { deleted?: number };
        const count = deleteData.deleted ?? (Array.isArray(parameters.assetIds) ? (parameters.assetIds as string[]).length : 1);
        return `已删除 ${count} 个资产`;
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
            return `已完成 ${dataObj.count} 项操作`;
          }
          if (dataObj.total !== undefined) {
            return `共 ${dataObj.total} 项`;
          }
        }
        return undefined;
    }
  } catch (error) {
    console.warn(`[AgentEngine] 格式化函数结果失败:`, error);
    return undefined;
  }
}

