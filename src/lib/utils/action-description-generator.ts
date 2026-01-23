/**
 * Agent 操作描述生成器
 * 根据函数名和参数生成用户友好的操作描述
 */

import type { FunctionCall } from "@/types/agent";
import { ENUM_VALUE_LABELS } from "./agent-params-formatter";

/**
 * 解析 JSON 字符串中的数组长度
 */
function parseArrayLength(value: unknown): number {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(value as string);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/**
 * 生成用户友好的操作描述
 */
export function generateActionDescription(functionCall: FunctionCall): string {
  const { name, parameters } = functionCall;

  try {
    switch (name) {
      // ============================================
      // 查询类操作
      // ============================================
      case "query_context":
        return "查询项目上下文";

      case "query_assets": {
        const parts: string[] = [];
        if (parameters.assetType === "image") {
          parts.push("查询图片资产");
        } else if (parameters.assetType === "video") {
          parts.push("查询视频资产");
        } else {
          parts.push("查询资产库");
        }
        if (parameters.tags) {
          const tags = Array.isArray(parameters.tags) ? parameters.tags.join(",") : String(parameters.tags);
          parts.push(`标签：${tags}`);
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
          const parts: string[] = ["生成图片资产"];
          if (assets[0].name) {
            parts.push(assets[0].name);
          }
          return parts.join(" - ");
        }
        return count > 0 ? `生成 ${count} 个图片资产` : "生成图片资产";
      }

      case "generate_video_asset": {
        const title = parameters.title as string | undefined;
        if (title) {
          return `生成视频资产 - ${title}`;
        }
        return "生成视频资产";
      }

      // ============================================
      // 修改类操作
      // ============================================
      case "update_asset": {
        const updates = parameters.updates as Array<{ assetId: string; name?: string }>;
        const count = updates?.length || 0;
        if (count === 1 && updates[0] && updates[0].name) {
          return `修改资产 - ${updates[0].name}`;
        }
        return count > 0 ? `修改 ${count} 个资产` : "修改资产";
      }

      case "set_project_info": {
        const params = parameters as {
          title?: string;
          description?: string;
          stylePrompt?: string;
          styleId?: string;
        };
        const fields: string[] = [];
        if (params.title) fields.push("标题");
        if (params.description) fields.push("描述");
        if (params.stylePrompt || params.styleId) fields.push("美术风格");
        return fields.length > 0 ? `设置项目${fields.join("、")}` : "设置项目信息";
      }

      // ============================================
      // 删除类操作
      // ============================================
      case "delete_asset": {
        const assetIds = parameters.assetIds as string[];
        const count = assetIds?.length || 0;
        return count > 0 ? `删除 ${count} 个资产` : "删除资产";
      }

      default:
        return functionCall.displayName || name;
    }
  } catch (error) {
    console.error("生成操作描述失败:", error);
    return functionCall.displayName || name;
  }
}
