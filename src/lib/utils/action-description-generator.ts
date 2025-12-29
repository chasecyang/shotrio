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
        if (parameters.episodeId) {
          return "查询项目上下文（含剧本和分镜）";
        }
        return "查询项目上下文";

      case "query_assets":
        if (parameters.tags) {
          const tags = Array.isArray(parameters.tags) ? parameters.tags.join(",") : String(parameters.tags);
          return `查询素材：${tags}`;
        }
        return "查询素材库";

      case "query_shots":
        if (parameters.shotIds && Array.isArray(parameters.shotIds)) {
          return `查询 ${parameters.shotIds.length} 个分镜详情`;
        }
        return "查询分镜列表";

      // ============================================
      // 创作类操作
      // ============================================
      case "create_shots": {
        const shots = parameters.shots as Array<{ shotSize?: string; description?: string }>;
        const count = shots?.length || 0;
        if (count === 1 && shots[0]) {
          const parts: string[] = ["创建分镜"];
          if (shots[0].shotSize) {
            const translated = ENUM_VALUE_LABELS.shotSize?.[shots[0].shotSize];
            parts.push(translated || shots[0].shotSize);
          }
          if (shots[0].description) {
            const desc = shots[0].description.slice(0, 20);
            parts.push(desc.length < shots[0].description.length ? `${desc}...` : desc);
          }
          return parts.join(" - ");
        }
        return count > 0 ? `创建 ${count} 个分镜` : "创建分镜";
      }

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
      case "update_shots": {
        const updates = parameters.updates as Array<{ shotId: string; shotSize?: string; duration?: number }>;
        const count = updates?.length || 0;
        if (count === 1 && updates[0]) {
          const parts: string[] = ["修改分镜"];
          const updateFields: string[] = [];
          
          if (updates[0].shotSize) {
            const translated = ENUM_VALUE_LABELS.shotSize?.[updates[0].shotSize];
            updateFields.push(translated || updates[0].shotSize);
          }
          if (updates[0].duration) {
            const seconds = Number(updates[0].duration) / 1000;
            updateFields.push(`${seconds}秒`);
          }
          
          if (updateFields.length > 0) {
            parts.push(updateFields.join(" · "));
          }
          return parts.join(" - ");
        }
        return count > 0 ? `修改 ${count} 个分镜` : "修改分镜";
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
      case "delete_shots": {
        const shotIds = parameters.shotIds as string[];
        const count = shotIds?.length || 0;
        return count > 0 ? `删除 ${count} 个分镜` : "删除分镜";
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

