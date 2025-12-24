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
      case "create_shot": {
        const shotData = data as { id?: string; description?: string | null; order?: number };
        // 优先使用 description，如果没有则使用 parameters 中的 description
        const description = shotData.description || (parameters.description as string | undefined);
        const order = shotData.order ?? (parameters.order ? parseInt(String(parameters.order)) : undefined);
        
        if (description) {
          return `已创建分镜 #${order || "?"}: ${description}`;
        }
        if (order !== undefined) {
          return `已创建分镜 #${order}`;
        }
        return shotData.id ? `已创建分镜 (ID: ${shotData.id.substring(0, 8)}...)` : "已创建分镜";
      }

      case "batch_create_shots": {
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
                return `已批量创建 ${createdCount} 个分镜，首个分镜${orderInfo}: ${firstShot.description}`;
              }
            }
          }
          return `已批量创建 ${createdCount} 个分镜`;
        }
        return "批量创建分镜完成";
      }

      case "update_shot": {
        const updatedFields: string[] = [];
        if (parameters.duration) updatedFields.push("时长");
        if (parameters.shotSize) updatedFields.push("景别");
        if (parameters.cameraMovement) updatedFields.push("运镜");
        if (parameters.description) updatedFields.push("描述");
        if (parameters.visualPrompt) updatedFields.push("视觉提示");
        if (parameters.imageAssetId) updatedFields.push("图片素材");
        
        if (updatedFields.length > 0) {
          return `已更新: ${updatedFields.join("、")}`;
        }
        return "已更新分镜";
      }

      case "delete_shots": {
        const deleteData = data as { deleted?: number };
        const count = deleteData.deleted ?? (Array.isArray(parameters.shotIds) ? (parameters.shotIds as string[]).length : 1);
        return `已删除 ${count} 个分镜`;
      }

      case "generate_asset": {
        if (parameters.name) {
          return `已创建生成任务: ${parameters.name}`;
        }
        if (parameters.prompt) {
          const prompt = String(parameters.prompt);
          const shortPrompt = prompt.length > 30 ? prompt.substring(0, 30) + "..." : prompt;
          return `已创建生成任务: ${shortPrompt}`;
        }
        return "已创建素材生成任务";
      }

      case "batch_generate_assets": {
        const batchData = data as { createdCount?: number; totalCount?: number };
        if (batchData.createdCount !== undefined) {
          return `已创建 ${batchData.createdCount} 个生成任务`;
        }
        return "已创建批量生成任务";
      }

      case "generate_shot_videos": {
        const shotIds = Array.isArray(parameters.shotIds) 
          ? (parameters.shotIds as string[]).length 
          : (typeof parameters.shotIds === "string" 
            ? JSON.parse(parameters.shotIds as string).length 
            : 1);
        return `已为 ${shotIds} 个分镜创建视频生成任务`;
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

      case "query_script_content": {
        const scriptData = data as { title?: string };
        if (scriptData.title) {
          return `已查询剧集: ${scriptData.title}`;
        }
        return "已查询剧本内容";
      }

      case "query_shots": {
        const shotsData = Array.isArray(data) ? data : [];
        return `查询到 ${shotsData.length} 个分镜`;
      }

      case "query_shot_details": {
        const shotData = data as { description?: string };
        if (shotData.description) {
          return `已查询分镜: ${shotData.description}`;
        }
        return "已查询分镜详情";
      }

      case "query_available_art_styles": {
        const stylesData = data as { styles?: unknown[]; message?: string };
        if (stylesData.message) {
          return stylesData.message;
        }
        if (Array.isArray(stylesData.styles)) {
          return `找到 ${stylesData.styles.length} 个美术风格`;
        }
        return "查询完成";
      }

      case "analyze_project_stats": {
        const statsData = data as { totalAssets?: number };
        if (statsData.totalAssets !== undefined) {
          return `项目共有 ${statsData.totalAssets} 个素材`;
        }
        return "已分析项目统计";
      }

      case "reorder_shots": {
        const shotOrders = parameters.shotOrders 
          ? (typeof parameters.shotOrders === "string" 
            ? JSON.parse(parameters.shotOrders as string) 
            : parameters.shotOrders)
          : {};
        const count = typeof shotOrders === "object" && shotOrders !== null 
          ? Object.keys(shotOrders).length 
          : 0;
        return `已重新排序 ${count} 个分镜`;
      }

      case "update_asset": {
        if (parameters.name) {
          return `已更新素材名称: ${parameters.name}`;
        }
        return "已更新素材";
      }

      case "delete_asset": {
        return "已删除素材";
      }

      case "set_project_art_style": {
        return "已设置项目美术风格";
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

