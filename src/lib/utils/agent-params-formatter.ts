/**
 * Agent 参数格式化工具
 * 将技术参数转换为用户友好的展示格式
 */

import { getAllEnumLabels } from "@/lib/constants/enums";
import { safeJSONParse, parseAsArray } from "./json-helpers";

/**
 * Prompt解析结果
 */
export interface PromptPart {
  text: string;
  isReference: boolean;
  label?: string;
}

/**
 * 参数键名中文映射
 */
const PARAM_KEY_LABELS: Record<string, string> = {
  // 基础 ID
  episodeId: "剧集ID",
  projectId: "项目ID",
  videoId: "视频ID",
  videoIds: "视频列表",
  assetId: "素材ID",
  assetIds: "素材列表",
  sourceAssetIds: "参考图",

  // 内容属性
  prompt: "提示词",
  name: "名称",
  tags: "标签",
  reason: "原因",
  description: "描述",
  visualPrompt: "视觉提示词",

  // 生成参数
  numImages: "生成数量",
  mode: "生成模式",
  assetType: "素材类型",
  autoGenerateImages: "自动生成图片",

  // 视频属性
  duration: "时长",
  aspectRatio: "宽高比",

  // 其他
  limit: "数量限制",
};

/**
 * 枚举值中文映射（从统一枚举管理中获取）
 */
export const ENUM_VALUE_LABELS: Record<string, Record<string, string>> = getAllEnumLabels();

/**
 * 格式化后的参数
 */
export interface FormattedParameter {
  key: string;
  label: string;
  value: string;
  rawValue: unknown;
  isAssetReference?: boolean; // 标记是否为素材引用参数
  assetIds?: string[]; // 如果是素材引用，提取的 assetId 列表
}

/**
 * 格式化模式
 */
type FormatMode = "detailed" | "concise";

/**
 * 格式化参数值（统一的基础函数）
 * @param key 参数键名
 * @param value 参数值
 * @param mode 格式化模式：detailed（详细）或 concise（简洁）
 */
function formatParameterValue(key: string, value: unknown, mode: FormatMode = "detailed"): string {
  // null/undefined
  if (value === null || value === undefined) {
    return "-";
  }

  // 布尔值
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }

  // 数字
  if (typeof value === "number") {
    // 时长特殊处理（毫秒转秒）
    if (key === "duration") {
      const seconds = value / 1000;
      return `${seconds}秒`;
    }
    return String(value);
  }

  // 字符串
  if (typeof value === "string") {
    // 特殊处理：tags（标签）
    if (key === "tags" && mode === "concise") {
      return handleTagsValue(value);
    }

    // 特殊处理：sourceAssetIds（参考图）
    if (key === "sourceAssetIds" && mode === "concise") {
      return handleSourceAssetIdsValue(value);
    }

    // 尝试解析 JSON 字符串
    const parsed = safeJSONParse(value);
    if (parsed !== undefined) {
      if (Array.isArray(parsed)) {
        return formatArrayValue(parsed, key, mode);
      }
      if (typeof parsed === "object" && parsed !== null) {
        return formatObjectValue(parsed as Record<string, unknown>, mode);
      }
    }

    // 枚举值翻译
    if (ENUM_VALUE_LABELS[key]?.[value]) {
      return ENUM_VALUE_LABELS[key][value];
    }

    // 截断长文本（简洁模式）
    if (mode === "concise" && (key === "prompt" || key === "description" || key === "visualPrompt" || key === "content")) {
      return truncateText(value, 100);
    }

    return value;
  }

  // 数组
  if (Array.isArray(value)) {
    return formatArrayValue(value, key, mode);
  }

  // 对象
  if (typeof value === "object") {
    return formatObjectValue(value as Record<string, unknown>, mode);
  }

  return String(value);
}

/**
 * 处理标签值（简洁模式专用）
 */
function handleTagsValue(value: string): string {
  const parsed = safeJSONParse<string[]>(value);
  if (Array.isArray(parsed)) {
    return parsed.join(", ");
  }
  // 不是JSON，可能是逗号分隔的字符串
  if (value.includes(",")) {
    return value;
  }
  return value;
}

/**
 * 处理参考图值（简洁模式专用）
 */
function handleSourceAssetIdsValue(value: string): string {
  const parsed = safeJSONParse<string[]>(value);
  if (Array.isArray(parsed)) {
    return parsed.length > 0 ? `${parsed.length}张参考图` : "无";
  }
  return value ? "有参考图" : "无";
}

/**
 * 格式化数组值
 */
function formatArrayValue(arr: unknown[], key?: string, mode: FormatMode = "detailed"): string {
  if (arr.length === 0) {
    return "空";
  }

  // 简洁模式：特殊处理
  if (mode === "concise") {
    // 标签数组：显示内容
    if (key === "tags") {
      return arr.join(", ");
    }
    // 参考图数组
    if (key === "sourceAssetIds") {
      return arr.length > 0 ? `${arr.length}张参考图` : "无";
    }
    // 视频或素材数组：显示数量
    if (key === "videos" && arr.length > 0 && typeof arr[0] === "object") {
      return `${arr.length}个视频`;
    }
    if (key === "assets" && arr.length > 0 && typeof arr[0] === "object") {
      return `${arr.length}个素材`;
    }
    if (key === "videoIds" || key === "assetIds") {
      return `${arr.length}项`;
    }
    // 其他数组：显示数量
    return `${arr.length}项`;
  }

  // 详细模式
  if (arr.length <= 3) {
    return arr.map((item) => String(item)).join(", ");
  }

  return `[${arr.length}项]`;
}

/**
 * 格式化对象值
 */
function formatObjectValue(obj: Record<string, unknown>, mode: FormatMode = "detailed"): string {
  const entries = Object.entries(obj);
  if (entries.length === 0) {
    return "{}";
  }

  // 简洁模式：只显示属性数量
  if (mode === "concise") {
    const count = Object.keys(obj).length;
    return `${count}个属性`;
  }

  // 详细模式
  if (entries.length <= 2) {
    return entries
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(", ");
  }

  return `{${entries.length}个属性}`;
}

/**
 * 格式化参数对象为可展示的列表（详细模式）
 */
export function formatParameters(
  parameters: Record<string, unknown>
): FormattedParameter[] {
  return Object.entries(parameters).map(([key, value]) => {
    const label = PARAM_KEY_LABELS[key] || key;
    const formattedValue = formatParameterValue(key, value, "detailed");

    return {
      key,
      label,
      value: formattedValue,
      rawValue: value,
    };
  });
}

/**
 * 技术性ID参数（在确认卡片中应该隐藏，但素材ID除外，需要特殊处理）
 */
const TECHNICAL_ID_PARAMS = new Set([
  "episodeId",
  "projectId",
  "videoId",
  "styleId",
]);

/**
 * 判断参数是否为素材引用（assetId 或 assetIds）
 */
function isAssetReferenceParam(key: string): boolean {
  // 匹配 assetId, assetIds, sourceAssetIds 等
  return /assetIds?$/i.test(key);
}

/**
 * 从参数值中提取 assetId 列表
 */
function extractAssetIds(value: unknown): string[] {
  if (!value) return [];
  
  // 使用工具函数解析为数组
  const arr = parseAsArray<string>(value);
  return arr.filter((id): id is string => typeof id === "string");
}

/**
 * 用户可理解的关键参数（优先显示）
 */
const KEY_PARAMS_PRIORITY = [
  "name",
  "title",
  "description",
  "prompt",
  "tags",
  "duration",
  "aspectRatio",
  "numImages",
  "reason",
];

/**
 * 判断参数是否应该在确认卡片中显示
 */
function shouldShowParameter(key: string): boolean {
  // 隐藏技术性ID
  if (TECHNICAL_ID_PARAMS.has(key)) {
    return false;
  }
  
  // 素材引用参数需要特殊处理，保留显示
  if (isAssetReferenceParam(key)) {
    return true;
  }
  
  // 显示关键参数
  return true;
}

/**
 * 截断长文本
 */
function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + "...";
}

/**
 * 格式化参数对象为确认卡片展示（过滤ID，只显示关键参数）
 */
export function formatParametersForConfirmation(
  parameters: Record<string, unknown>
): FormattedParameter[] {
  // 过滤掉技术性ID参数
  const filtered = Object.entries(parameters).filter(([key]) =>
    shouldShowParameter(key)
  );

  // 按优先级排序
  filtered.sort(([keyA], [keyB]) => {
    const priorityA = KEY_PARAMS_PRIORITY.indexOf(keyA);
    const priorityB = KEY_PARAMS_PRIORITY.indexOf(keyB);
    
    // 如果都在优先级列表中，按优先级排序
    if (priorityA !== -1 && priorityB !== -1) {
      return priorityA - priorityB;
    }
    
    // 优先级列表中的参数排在前面
    if (priorityA !== -1) return -1;
    if (priorityB !== -1) return 1;
    
    // 都不在优先级列表中，保持原顺序
    return 0;
  });

  // 格式化参数（使用简洁模式）
  return filtered.map(([key, value]) => {
    const label = PARAM_KEY_LABELS[key] || key;
    const formattedValue = formatParameterValue(key, value, "concise");
    
    // 检查是否为素材引用参数
    const isAssetRef = isAssetReferenceParam(key);
    const assetIds = isAssetRef ? extractAssetIds(value) : undefined;

    return {
      key,
      label,
      value: formattedValue,
      rawValue: value,
      isAssetReference: isAssetRef,
      assetIds,
    };
  });
}

/**
 * 解析Prompt中的@label引用
 */
export function parsePromptReferences(prompt: string): PromptPart[] {
  // 匹配 @标签名 模式 (支持中文、字母、数字、连字符、下划线)
  const regex = /@([\u4e00-\u9fa5\w-]+)/g;
  const parts: PromptPart[] = [];
  let lastIndex = 0;
  
  let match;
  while ((match = regex.exec(prompt)) !== null) {
    // 添加普通文本
    if (match.index > lastIndex) {
      parts.push({
        text: prompt.slice(lastIndex, match.index),
        isReference: false
      });
    }
    
    // 添加引用
    parts.push({
      text: match[0], // 包含@符号
      isReference: true,
      label: match[1]
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // 添加剩余文本
  if (lastIndex < prompt.length) {
    parts.push({
      text: prompt.slice(lastIndex),
      isReference: false
    });
  }
  
  return parts;
}

