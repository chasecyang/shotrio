/**
 * Agent 参数格式化工具
 * 将技术参数转换为用户友好的展示格式
 */

/**
 * 参数键名中文映射
 */
const PARAM_KEY_LABELS: Record<string, string> = {
  // 基础 ID
  episodeId: "剧集ID",
  projectId: "项目ID",
  shotId: "分镜ID",
  shotIds: "分镜列表",
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

  // 分镜属性
  duration: "时长",
  shotSize: "景别",
  cameraMovement: "运镜方式",
  shotOrders: "分镜顺序",

  // 其他
  limit: "数量限制",
};

/**
 * 枚举值中文映射
 */
export const ENUM_VALUE_LABELS: Record<string, Record<string, string>> = {
  // 素材类型
  assetType: {
    character: "角色",
    scene: "场景",
    prop: "道具",
    reference: "参考图",
  },

  // 生成模式
  mode: {
    "text-to-image": "文生图",
    "image-to-image": "图生图",
  },

  // 景别
  shotSize: {
    extreme_long_shot: "远景",
    long_shot: "全景",
    full_shot: "全身",
    medium_shot: "中景",
    close_up: "近景",
    extreme_close_up: "特写",
  },

  // 运镜
  cameraMovement: {
    static: "固定镜头",
    push_in: "推进",
    pull_out: "拉出",
    pan_left: "向左摇",
    pan_right: "向右摇",
    tilt_up: "向上摇",
    tilt_down: "向下摇",
    tracking: "跟踪",
    crane_up: "升起",
    crane_down: "降落",
    orbit: "环绕",
    zoom_in: "放大",
    zoom_out: "缩小",
    handheld: "手持",
  },
};

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
 * 格式化参数值
 */
function formatParameterValue(key: string, value: unknown): string {
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
    // 尝试解析 JSON 字符串
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return formatArrayValue(parsed);
      }
      if (typeof parsed === "object" && parsed !== null) {
        return formatObjectValue(parsed);
      }
    } catch {
      // 不是 JSON，继续作为字符串处理
    }

    // 枚举值翻译
    if (ENUM_VALUE_LABELS[key]?.[value]) {
      return ENUM_VALUE_LABELS[key][value];
    }

    return value;
  }

  // 数组
  if (Array.isArray(value)) {
    return formatArrayValue(value);
  }

  // 对象
  if (typeof value === "object" && value !== null) {
    return formatObjectValue(value as Record<string, unknown>);
  }

  return String(value);
}

/**
 * 格式化数组值
 */
function formatArrayValue(arr: unknown[]): string {
  if (arr.length === 0) {
    return "空";
  }

  if (arr.length <= 3) {
    return arr.map((item) => String(item)).join(", ");
  }

  return `[${arr.length}项]`;
}

/**
 * 格式化对象值
 */
function formatObjectValue(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj);
  if (entries.length === 0) {
    return "{}";
  }

  if (entries.length <= 2) {
    return entries
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(", ");
  }

  return `{${entries.length}个属性}`;
}

/**
 * 格式化参数对象为可展示的列表
 */
export function formatParameters(
  parameters: Record<string, unknown>
): FormattedParameter[] {
  return Object.entries(parameters).map(([key, value]) => {
    const label = PARAM_KEY_LABELS[key] || key;
    const formattedValue = formatParameterValue(key, value);

    return {
      key,
      label,
      value: formattedValue,
      rawValue: value,
    };
  });
}

/**
 * 展开数组详情（用于折叠展示）
 */
export function expandArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) {
    try {
      const parsed = JSON.parse(String(value));
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item));
      }
    } catch {
      // ignore
    }
    return [];
  }

  return value.map((item) => String(item));
}

/**
 * 技术性ID参数（在确认卡片中应该隐藏，但素材ID除外，需要特殊处理）
 */
const TECHNICAL_ID_PARAMS = new Set([
  "episodeId",
  "projectId",
  "shotId",
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
  
  // 数组类型
  if (Array.isArray(value)) {
    return value.filter((id): id is string => typeof id === "string");
  }
  
  // 字符串类型
  if (typeof value === "string") {
    // 尝试解析 JSON 数组
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is string => typeof id === "string");
      }
    } catch {
      // 不是 JSON，可能是单个 ID
    }
    // 单个 ID
    return [value];
  }
  
  return [];
}

/**
 * 用户可理解的关键参数（优先显示）
 */
const KEY_PARAMS_PRIORITY = [
  "name",
  "description",
  "prompt",
  "tags",
  "shotSize",
  "cameraMovement",
  "duration",
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
 * 格式化参数值（用于确认卡片，更简洁）
 */
function formatParameterValueForConfirmation(key: string, value: unknown): string {
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
    if (key === "tags") {
      // 尝试解析为数组
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.join(", ");
        }
      } catch {
        // 不是JSON，可能是逗号分隔的字符串
        if (value.includes(",")) {
          return value;
        }
      }
      return value;
    }

    // 特殊处理：sourceAssetIds（参考图）
    if (key === "sourceAssetIds") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.length > 0 ? `${parsed.length}张参考图` : "无";
        }
      } catch {
        // 不是JSON数组
      }
      return value ? "有参考图" : "无";
    }

    // 尝试解析 JSON 字符串
    try {
      const parsed = JSON.parse(value);
      
      // 数组：只显示数量
      if (Array.isArray(parsed)) {
        // 特殊处理：如果是分镜或素材数组，尝试提取更多信息
        if (key === "shots" && parsed.length > 0 && typeof parsed[0] === "object") {
          return `${parsed.length}个分镜`;
        }
        if (key === "assets" && parsed.length > 0 && typeof parsed[0] === "object") {
          return `${parsed.length}个素材`;
        }
        if (key === "shotIds" || key === "assetIds") {
          return `${parsed.length}项`;
        }
        return `${parsed.length}项`;
      }
      
      // 对象：显示属性数量
      if (typeof parsed === "object" && parsed !== null) {
        const count = Object.keys(parsed).length;
        return `${count}个属性`;
      }
    } catch {
      // 不是 JSON，继续作为字符串处理
    }

    // 枚举值翻译
    if (ENUM_VALUE_LABELS[key]?.[value]) {
      return ENUM_VALUE_LABELS[key][value];
    }

    // 截断长文本
    if (key === "prompt" || key === "description" || key === "visualPrompt") {
      return truncateText(value, 100);
    }

    return value;
  }

  // 数组：显示数量或内容
  if (Array.isArray(value)) {
    // 特殊处理：tags数组
    if (key === "tags") {
      return value.join(", ");
    }
    // 特殊处理：sourceAssetIds数组
    if (key === "sourceAssetIds") {
      return value.length > 0 ? `${value.length}张参考图` : "无";
    }
    return `${value.length}项`;
  }

  // 对象：显示属性数量
  if (typeof value === "object") {
    const count = Object.keys(value).length;
    return `${count}个属性`;
  }

  return String(value);
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

  // 格式化参数
  return filtered.map(([key, value]) => {
    const label = PARAM_KEY_LABELS[key] || key;
    const formattedValue = formatParameterValueForConfirmation(key, value);
    
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

