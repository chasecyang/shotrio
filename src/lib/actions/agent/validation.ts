/**
 * Agent Function 参数校验入口
 * 
 * 在 Agent 执行 function 前校验参数，提前发现错误并返回给 AI 修正
 */

/**
 * 参数校验结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalizedConfig?: Record<string, unknown>;
}

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
      case "generate_video_asset":
        return validateGenerateVideoParams(params);

      // 未来可扩展其他 function 的校验
      case "generate_image_asset":
        return validateGenerateAssetsParams(params);

      case "set_art_style":
        return validateSetArtStyleParams(params);

      // 其他 function 暂不校验（默认通过）
      case "query_context":
      case "query_assets":
      case "update_episode":
      case "update_asset":
      case "delete_asset":
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
 * 校验 generate_video_asset 参数
 * 统一的首尾帧生成方式（Veo3 固定 8 秒）
 */
function validateGenerateVideoParams(params: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. 校验 prompt（必填）
  if (!params.prompt || typeof params.prompt !== 'string') {
    errors.push("prompt 是必填字段");
  } else if (params.prompt.trim().length < 10) {
    errors.push("prompt 必须至少包含 10 个字符");
  }

  // 2. 校验 start_image_url（必填）
  if (!params.start_image_url || typeof params.start_image_url !== 'string') {
    errors.push("start_image_url 是必填字段");
  }

  // 3. 校验 aspect_ratio 格式（可选，Veo3 不支持 1:1）
  if (params.aspect_ratio && typeof params.aspect_ratio === 'string' && !["16:9", "9:16"].includes(params.aspect_ratio)) {
    errors.push("aspect_ratio 必须是 '16:9' 或 '9:16'");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalizedConfig: {
      prompt: typeof params.prompt === 'string' ? params.prompt.trim() : '',
      start_image_url: params.start_image_url as string,
      end_image_url: params.end_image_url as string | undefined,
      aspect_ratio: params.aspect_ratio as "16:9" | "9:16" | undefined,
      negative_prompt: params.negative_prompt as string | undefined,
    },
  };
}


/**
 * 校验 generate_image_asset 参数
 * TODO: 实现完整校验
 */
function validateGenerateAssetsParams(params: Record<string, unknown>): ValidationResult {
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
  params.assets.forEach((asset: Record<string, unknown>, index: number) => {
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
 * 校验 set_art_style 参数
 */
function validateSetArtStyleParams(params: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 校验 styleId（必填）
  if (!params.styleId || typeof params.styleId !== 'string') {
    errors.push("styleId 是必填字段，请先使用 query_context 获取可用的美术风格列表");
  } else if (params.styleId.trim().length === 0) {
    errors.push("styleId 不能为空");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

