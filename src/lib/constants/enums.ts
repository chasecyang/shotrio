/**
 * 统一的枚举定义和映射
 * 集中管理所有枚举值的转换和显示
 */

/**
 * 景别枚举映射
 * API使用大写格式，数据库使用小写格式，UI显示中文
 */
export const SHOT_SIZE_ENUM = {
  // API -> DB
  apiToDb: {
    'WIDE': 'long_shot',
    'FULL': 'full_shot',
    'MEDIUM': 'medium_shot',
    'CLOSE_UP': 'close_up',
    'EXTREME_CLOSE_UP': 'extreme_close_up',
    'EXTREME_LONG_SHOT': 'extreme_long_shot',
  } as const,
  
  // DB -> 中文
  dbToLabel: {
    'extreme_long_shot': '远景',
    'long_shot': '全景',
    'full_shot': '全身',
    'medium_shot': '中景',
    'close_up': '近景',
    'extreme_close_up': '特写',
  } as const,
};

/**
 * 运镜方式枚举映射
 * API使用大写格式，数据库使用小写格式，UI显示中文
 */
export const CAMERA_MOVEMENT_ENUM = {
  // API -> DB
  apiToDb: {
    'STATIC': 'static',
    'PUSH_IN': 'push_in',
    'PULL_OUT': 'pull_out',
    'PAN_LEFT': 'pan_left',
    'PAN_RIGHT': 'pan_right',
    'TILT_UP': 'tilt_up',
    'TILT_DOWN': 'tilt_down',
    'TRACKING': 'tracking',
    'CRANE_UP': 'crane_up',
    'CRANE_DOWN': 'crane_down',
    'ORBIT': 'orbit',
    'ZOOM_IN': 'zoom_in',
    'ZOOM_OUT': 'zoom_out',
    'HANDHELD': 'handheld',
  } as const,
  
  // DB -> 中文
  dbToLabel: {
    'static': '固定镜头',
    'push_in': '推进',
    'pull_out': '拉出',
    'pan_left': '向左摇',
    'pan_right': '向右摇',
    'tilt_up': '向上摇',
    'tilt_down': '向下摇',
    'tracking': '跟踪',
    'crane_up': '升起',
    'crane_down': '降落',
    'orbit': '环绕',
    'zoom_in': '放大',
    'zoom_out': '缩小',
    'handheld': '手持',
  } as const,
};

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
 * 映射 API 枚举值到数据库枚举值
 * @param value API枚举值（大写或小写）
 * @param enumMap 枚举映射对象
 * @returns 数据库枚举值
 */
export function mapApiToDb<T extends Record<string, string>>(
  value: string,
  enumMap: { apiToDb: T }
): string {
  // 尝试直接匹配（大写格式）
  if (value in enumMap.apiToDb) {
    return enumMap.apiToDb[value as keyof T];
  }
  
  // 尝试转换为大写后匹配
  const upperValue = value.toUpperCase();
  if (upperValue in enumMap.apiToDb) {
    return enumMap.apiToDb[upperValue as keyof T];
  }
  
  // 如果值已经是数据库格式（小写+下划线），直接返回
  const dbValues = Object.values(enumMap.apiToDb);
  if (dbValues.includes(value)) {
    return value;
  }
  
  // 都不匹配，抛出错误
  const validValues = Object.keys(enumMap.apiToDb).join(', ');
  throw new Error(`无效的枚举值: ${value}. 支持的值: ${validValues}`);
}

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
    shotSize: SHOT_SIZE_ENUM.dbToLabel,
    cameraMovement: CAMERA_MOVEMENT_ENUM.dbToLabel,
    assetType: ASSET_TYPE_ENUM.dbToLabel,
    mode: GENERATION_MODE_ENUM.dbToLabel,
  };
}

