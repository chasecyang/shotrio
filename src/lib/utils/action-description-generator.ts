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

      case "query_assets":
        if (parameters.tags) {
          const tags = Array.isArray(parameters.tags) ? parameters.tags.join(",") : String(parameters.tags);
          return `查询素材：${tags}`;
        }
        return "查询素材库";

      case "query_videos":
        if (parameters.videoIds && Array.isArray(parameters.videoIds)) {
          return `查询 ${parameters.videoIds.length} 个视频详情`;
        }
        return "查询视频列表";

      // ============================================
      // 创作类操作
      // ============================================

      case "generate_assets": {
        const assets = parameters.assets as Array<{ name?: string; prompt?: string }>;
        const count = assets?.length || 0;
        if (count === 1 && assets[0]) {
          const parts: string[] = ["生成素材"];
          if (assets[0].name) {
            parts.push(assets[0].name);
          }
          return parts.join(" - ");
        }
        return count > 0 ? `生成 ${count} 个素材` : "生成素材";
      }

      // ============================================
      // 修改类操作
      // ============================================
      case "update_videos": {
        const updates = parameters.updates as Array<{ videoId: string; title?: string; prompt?: string }>;
        const count = updates?.length || 0;
        if (count === 1 && updates[0]) {
          const parts: string[] = ["修改视频"];
          if (updates[0].title) {
            parts.push(updates[0].title);
          }
          return parts.join(" - ");
        }
        return count > 0 ? `修改 ${count} 个视频` : "修改视频";
      }

      case "update_assets": {
        const updates = parameters.updates as Array<{ assetId: string; name?: string }>;
        const count = updates?.length || 0;
        if (count === 1 && updates[0] && updates[0].name) {
          return `修改素材 - ${updates[0].name}`;
        }
        return count > 0 ? `修改 ${count} 个素材` : "修改素材";
      }

      case "set_art_style":
        return "设置美术风格";

      // ============================================
      // 删除类操作
      // ============================================
      case "delete_videos": {
        const videoIds = parameters.videoIds as string[];
        const count = videoIds?.length || 0;
        return count > 0 ? `删除 ${count} 个视频` : "删除视频";
      }

      case "delete_assets": {
        const assetIds = parameters.assetIds as string[];
        const count = assetIds?.length || 0;
        return count > 0 ? `删除 ${count} 个素材` : "删除素材";
      }

      default:
        return functionCall.displayName || name;
    }
  } catch (error) {
    console.error("生成操作描述失败:", error);
    return functionCall.displayName || name;
  }
}

