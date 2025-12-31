/**
 * 统一的枚举定义和映射
 * 集中管理所有枚举值的转换和显示
 */

/**
 * 素材类型枚举映射
 */
export const ASSET_TYPE_ENUM = {
  dbToLabel: {
    'character': '角色',
    'scene': '场景',
    'prop': '道具',
    'reference': '参考图',
  } as const,
};

/**
 * 生成模式枚举映射
 */
export const GENERATION_MODE_ENUM = {
  dbToLabel: {
    'text-to-image': '文生图',
    'image-to-image': '图生图',
  } as const,
};

/**
 * 映射数据库枚举值到中文标签
 * @param value 数据库枚举值
 * @param labelMap 标签映射对象
 * @returns 中文标签，如果未找到则返回原值
 */
export function mapDbToLabel<T extends Record<string, string>>(
  value: string,
  labelMap: { dbToLabel: T }
): string {
  if (value in labelMap.dbToLabel) {
    return labelMap.dbToLabel[value as keyof T];
  }
  return value;
}

/**
 * 获取所有枚举的中文标签映射（用于参数格式化）
 */
export function getAllEnumLabels(): Record<string, Record<string, string>> {
  return {
    assetType: ASSET_TYPE_ENUM.dbToLabel,
    mode: GENERATION_MODE_ENUM.dbToLabel,
  };
}

