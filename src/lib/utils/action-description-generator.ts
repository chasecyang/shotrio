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
      case "query_script_content":
        return "读取剧本内容";

      case "query_assets":
        if (parameters.tags) {
          return `查询素材：${parameters.tags}`;
        }
        return "查询素材库";

      case "query_shots":
        return "查询分镜列表";

      case "query_shot_details":
        return "查询分镜详情";

      case "analyze_project_stats":
        return "分析项目统计";

      case "query_available_art_styles":
        return "查询可用美术风格";

      // ============================================
      // 创建类操作
      // ============================================
      case "create_shot": {
        const parts: string[] = ["创建分镜"];
        if (parameters.shotSize) {
          const translated = ENUM_VALUE_LABELS.shotSize?.[parameters.shotSize as string];
          parts.push(translated || (parameters.shotSize as string));
        }
        if (parameters.description && typeof parameters.description === "string") {
          const desc = parameters.description.slice(0, 20);
          parts.push(desc.length < parameters.description.length ? `${desc}...` : desc);
        }
        return parts.join(" - ");
      }

      case "batch_create_shots": {
        const count = parseArrayLength(parameters.shots);
        return count > 0 ? `批量创建 ${count} 个分镜` : "批量创建分镜";
      }

      // ============================================
      // 生成类操作
      // ============================================
      case "generate_shot_videos": {
        const count = parseArrayLength(parameters.shotIds);
        return count > 0 ? `生成 ${count} 个分镜视频` : "生成分镜视频";
      }

      case "generate_asset": {
        const parts: string[] = ["生成素材"];
        if (parameters.name) {
          parts.push(parameters.name as string);
        }
        if (parameters.tags && typeof parameters.tags === "string") {
          const tags = (parameters.tags as string).split(",");
          if (tags[0]) {
            parts.push(`(${tags[0]})`);
          }
        }
        return parts.join(" - ");
      }

      case "batch_generate_assets": {
        const count = parseArrayLength(parameters.assets);
        return count > 0 ? `批量生成 ${count} 个素材` : "批量生成素材";
      }

      // ============================================
      // 修改类操作
      // ============================================
      case "update_shot": {
        const parts: string[] = ["修改分镜"];
        const updates: string[] = [];
        
        if (parameters.shotSize) {
          const translated = ENUM_VALUE_LABELS.shotSize?.[parameters.shotSize as string];
          updates.push(translated || (parameters.shotSize as string));
        }
        if (parameters.duration) {
          const seconds = Number(parameters.duration) / 1000;
          updates.push(`${seconds}秒`);
        }
        if (parameters.cameraMovement) {
          const translated = ENUM_VALUE_LABELS.cameraMovement?.[parameters.cameraMovement as string];
          updates.push(translated || (parameters.cameraMovement as string));
        }
        
        if (updates.length > 0) {
          parts.push(updates.join(" · "));
        }
        return parts.join(" - ");
      }

      case "batch_update_shot_duration": {
        const count = parseArrayLength(parameters.shotIds);
        const duration = parameters.duration ? `${Number(parameters.duration) / 1000}秒` : "";
        return count > 0 
          ? `批量修改 ${count} 个分镜时长${duration ? ` - ${duration}` : ""}`
          : "批量修改分镜时长";
      }

      case "update_asset": {
        const parts: string[] = ["修改素材"];
        if (parameters.name) {
          parts.push(parameters.name as string);
        }
        return parts.join(" - ");
      }

      case "reorder_shots":
        return "重新排序分镜";

      case "set_project_art_style":
        return "设置美术风格";

      // ============================================
      // 删除类操作
      // ============================================
      case "delete_shots": {
        const count = parseArrayLength(parameters.shotIds);
        return count > 0 ? `删除 ${count} 个分镜` : "删除分镜";
      }

      case "delete_asset":
        return "删除素材";

      case "delete_assets": {
        const count = parseArrayLength(parameters.assetIds);
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

