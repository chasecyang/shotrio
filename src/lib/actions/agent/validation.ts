/**
 * Agent Function 参数校验入口
 * 
 * 在 Agent 执行 function 前校验参数，提前发现错误并返回给 AI 修正
 */

import { validateKlingO1Config, type ValidationResult } from "@/lib/utils/video-validation";

/**
 * 校验 Function 参数
 * 
 * @param functionName - Function 名称
 * @param argumentsJson - 参数 JSON 字符串
 * @returns 校验结果
 */
export async function validateFunctionParameters(
  functionName: string,
  argumentsJson: string
): Promise<ValidationResult> {
  try {
    const params = JSON.parse(argumentsJson);

    switch (functionName) {
      case "generate_shot_video":
        return validateGenerateShotVideoParams(params);

      // 未来可扩展其他 function 的校验
      case "generate_assets":
        return validateGenerateAssetsParams(params);

      case "create_shots":
        return validateCreateShotsParams(params);

      // 其他 function 暂不校验（默认通过）
      case "query_context":
      case "query_assets":
      case "query_shots":
      case "update_episode":
      case "update_shots":
      case "update_assets":
      case "set_art_style":
      case "delete_shots":
      case "delete_assets":
        return { valid: true, errors: [], warnings: [] };

      default:
        // 未知 function，默认通过（由 executor 处理）
        console.warn(`[Validation] 未知的 function: ${functionName}，跳过校验`);
        return { valid: true, errors: [], warnings: [] };
    }
  } catch (error) {
    return {
      valid: false,
      errors: [
        `参数解析失败: ${error instanceof Error ? error.message : "未知错误"}`,
      ],
      warnings: [],
    };
  }
}

/**
 * 校验 generate_shot_video 参数
 */
function validateGenerateShotVideoParams(params: any): ValidationResult {
  const errors: string[] = [];

  // 检查必填参数
  if (!params.shotId) {
    errors.push("缺少必填参数 shotId");
  }

  if (!params.klingO1Config) {
    errors.push("缺少必填参数 klingO1Config");
    return { valid: false, errors, warnings: [] };
  }

  // 校验 klingO1Config
  const configValidation = validateKlingO1Config(params.klingO1Config);

  // 如果有 shotId 错误，合并到结果中
  if (errors.length > 0) {
    return {
      valid: false,
      errors: [...errors, ...configValidation.errors],
      warnings: configValidation.warnings,
      normalizedConfig: configValidation.normalizedConfig,
    };
  }

  return configValidation;
}

/**
 * 校验 generate_assets 参数
 * TODO: 实现完整校验
 */
function validateGenerateAssetsParams(params: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!params.assets || !Array.isArray(params.assets)) {
    errors.push("缺少必填参数 assets（数组类型）");
    return { valid: false, errors, warnings };
  }

  if (params.assets.length === 0) {
    errors.push("assets 数组不能为空");
    return { valid: false, errors, warnings };
  }

  // 检查每个 asset
  params.assets.forEach((asset: any, index: number) => {
    if (!asset.prompt || typeof asset.prompt !== 'string') {
      errors.push(`assets[${index}] 缺少必填参数 prompt`);
    } else if (asset.prompt.trim().length < 5) {
      errors.push(`assets[${index}].prompt 必须至少包含 5 个字符`);
    }

    // 检查 tags 格式
    if (asset.tags && !Array.isArray(asset.tags)) {
      errors.push(`assets[${index}].tags 必须是数组类型`);
    }

    // 检查 sourceAssetIds 格式
    if (asset.sourceAssetIds && !Array.isArray(asset.sourceAssetIds)) {
      errors.push(`assets[${index}].sourceAssetIds 必须是数组类型`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 校验 create_shots 参数
 * TODO: 实现完整校验
 */
function validateCreateShotsParams(params: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!params.episodeId) {
    errors.push("缺少必填参数 episodeId");
  }

  if (!params.shots || !Array.isArray(params.shots)) {
    errors.push("缺少必填参数 shots（数组类型）");
    return { valid: false, errors, warnings };
  }

  if (params.shots.length === 0) {
    errors.push("shots 数组不能为空");
    return { valid: false, errors, warnings };
  }

  // 检查每个 shot
  params.shots.forEach((shot: any, index: number) => {
    if (!shot.shotSize) {
      errors.push(`shots[${index}] 缺少必填参数 shotSize`);
    }

    if (!shot.description || typeof shot.description !== 'string') {
      errors.push(`shots[${index}] 缺少必填参数 description`);
    } else if (shot.description.trim().length < 5) {
      warnings.push(`shots[${index}].description 较短（少于 5 个字符），建议补充更多细节`);
    }

    // 检查 duration 格式（如果提供）
    if (shot.duration !== undefined) {
      if (typeof shot.duration !== 'number' || shot.duration <= 0) {
        errors.push(`shots[${index}].duration 必须是正数（单位：秒）`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

