/**
 * JSON 处理工具函数
 * 提供安全的 JSON 解析和类型转换
 */

/**
 * 安全解析 JSON 字符串
 * @param value 要解析的值
 * @param fallback 解析失败时的默认值
 * @returns 解析结果或默认值
 */
export function safeJSONParse<T = unknown>(value: string | unknown, fallback?: T): T | undefined {
  // 如果不是字符串，直接返回
  if (typeof value !== "string") {
    return value as T;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * 确保返回数组
 * @param value 输入值（可能是字符串、数组或其他）
 * @returns 数组
 */
export function parseAsArray<T = unknown>(value: unknown): T[] {
  // 已经是数组
  if (Array.isArray(value)) {
    return value as T[];
  }

  // 尝试解析字符串
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed as T[];
      }
    } catch {
      // 解析失败，继续
    }
  }

  // 单个值包装为数组
  if (value !== null && value !== undefined) {
    return [value as T];
  }

  return [];
}

/**
 * 确保返回对象
 * @param value 输入值（可能是字符串、对象或其他）
 * @returns 对象
 */
export function parseAsObject<T extends Record<string, unknown> = Record<string, unknown>>(
  value: unknown
): T {
  // 已经是对象
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as T;
  }

  // 尝试解析字符串
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as T;
      }
    } catch {
      // 解析失败，继续
    }
  }

  // 返回空对象
  return {} as T;
}

/**
 * 安全的 JSON 字符串化
 * @param value 要字符串化的值
 * @param fallback 失败时的默认值
 * @returns JSON 字符串或默认值
 */
export function safeJSONStringify(value: unknown, fallback: string = "{}"): string {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

/**
 * 判断字符串是否为有效的 JSON
 * @param value 要检查的字符串
 * @returns 是否为有效 JSON
 */
export function isValidJSON(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

