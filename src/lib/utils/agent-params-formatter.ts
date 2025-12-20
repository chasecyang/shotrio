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
  sourceAssetIds: "源素材列表",

  // 内容属性
  prompt: "提示词",
  name: "名称",
  tags: "标签",
  reason: "原因",
  description: "描述",

  // 生成参数
  numImages: "生成数量",
  mode: "生成模式",
  assetType: "素材类型",
  autoGenerateImages: "自动生成图片",

  // 分镜属性
  duration: "时长",
  shotSize: "景别",
  cameraMovement: "运镜方式",
  description: "描述",
  visualPrompt: "视觉提示词",
  shotOrders: "分镜顺序",

  // 其他
  limit: "数量限制",
};

/**
 * 枚举值中文映射
 */
const ENUM_VALUE_LABELS: Record<string, Record<string, string>> = {
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
  if (typeof value === "object") {
    return formatObjectValue(value);
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

