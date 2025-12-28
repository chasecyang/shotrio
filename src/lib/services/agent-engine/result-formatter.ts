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
        const contextData = data as { episode?: unknown; shots?: unknown[]; assets?: { total?: number }; artStyles?: unknown[] };
        const parts: string[] = [];
        if (contextData.episode) parts.push("剧本");
        if (contextData.shots) parts.push(`分镜(${contextData.shots.length})`);
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
          return `找到 ${queryData.total} 个素材`;
        }
        return "查询完成";
      }

      case "query_shots": {
        const shotsData = data as { shots?: unknown[]; total?: number };
        const count = shotsData.total ?? (shotsData.shots?.length || 0);
        return `查询到 ${count} 个分镜`;
      }

      // ============================================
      // 创作类
      // ============================================
      case "create_shots": {
        const batchData = data as { createdCount?: number; shots?: Array<{ description?: string | null; order?: number }> };
        const createdCount = batchData.createdCount ?? (batchData.shots ? batchData.shots.length : 0);
        
        if (createdCount > 0) {
          // 尝试提取一些描述信息
          if (batchData.shots && batchData.shots.length > 0) {
            const firstShot = batchData.shots[0];
            if (firstShot.description) {
              const orderInfo = firstShot.order ? ` #${firstShot.order}` : "";
              if (createdCount === 1) {
                return `已创建分镜${orderInfo}: ${firstShot.description}`;
              } else {
                return `已创建 ${createdCount} 个分镜，首个分镜${orderInfo}: ${firstShot.description}`;
              }
            }
          }
          return `已创建 ${createdCount} 个分镜`;
        }
        return "创建分镜完成";
      }

      case "generate_assets": {
        const batchData = data as { createdCount?: number; assetIds?: string[]; totalCount?: number };
        if (batchData.createdCount !== undefined) {
          return `已创建 ${batchData.createdCount} 个生成任务`;
        }
        if (batchData.assetIds) {
          return `已创建 ${batchData.assetIds.length} 个生成任务`;
        }
        return "已创建素材生成任务";
      }

      case "generate_videos": {
        const shotIds = Array.isArray(parameters.shotIds) ? (parameters.shotIds as string[]).length : 1;
        return `已为 ${shotIds} 个分镜创建视频生成任务`;
      }

      // ============================================
      // 修改类
      // ============================================
      case "update_shots": {
        const updateData = data as { updated?: number; total?: number };
        if (updateData.updated !== undefined) {
          return `已更新 ${updateData.updated} 个分镜`;
        }
        return "已更新分镜";
      }

      case "update_assets": {
        const updateData = data as { updated?: number; total?: number };
        if (updateData.updated !== undefined) {
          return `已更新 ${updateData.updated} 个素材`;
        }
        return "已更新素材";
      }

      case "set_art_style": {
        return "已设置项目美术风格";
      }

      // ============================================
      // 删除类
      // ============================================
      case "delete_shots": {
        const deleteData = data as { deleted?: number };
        const count = deleteData.deleted ?? (Array.isArray(parameters.shotIds) ? (parameters.shotIds as string[]).length : 1);
        return `已删除 ${count} 个分镜`;
      }

      case "delete_assets": {
        const deleteData = data as { deleted?: number };
        const count = deleteData.deleted ?? (Array.isArray(parameters.assetIds) ? (parameters.assetIds as string[]).length : 1);
        return `已删除 ${count} 个素材`;
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

