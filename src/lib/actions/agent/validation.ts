/**
 * Agent Function 参数校验入口
 * 
 * 在 Agent 执行 function 前校验参数，提前发现错误并返回给 AI 修正
 */

import { validateReferenceToVideoConfig, type ValidationResult } from "@/lib/utils/video-validation";

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

      // 其他 function 暂不校验（默认通过）
      case "query_context":
      case "query_assets":
      case "update_episode":
      case "update_asset":
      case "set_art_style":
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
 * 支持两种生成方式：image-to-video, reference-to-video（包含视频续写）
 */
function validateGenerateVideoParams(params: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 获取生成方式（默认 reference-to-video 保持向后兼容）
  const type = params.videoGenerationType || "reference-to-video";

  // 根据类型路由到不同的校验函数
  switch (type) {
    case "image-to-video":
      if (!params.imageToVideoConfig) {
        errors.push("videoGenerationType='image-to-video' 时必须提供 imageToVideoConfig");
        return { valid: false, errors, warnings };
      }
      return validateImageToVideoConfig(params.imageToVideoConfig as Record<string, unknown>);

    case "reference-to-video":
      if (!params.referenceToVideoConfig) {
        errors.push("videoGenerationType='reference-to-video' 时必须提供 referenceToVideoConfig");
        return { valid: false, errors, warnings };
      }
      return validateReferenceToVideoConfig(params.referenceToVideoConfig as import("@/lib/utils/video-validation").ExtendedVideoConfig);

    default:
      errors.push(`未知的 videoGenerationType: ${type}。仅支持 image-to-video 和 reference-to-video`);
      return { valid: false, errors, warnings };
  }
}

/**
 * 校验 image-to-video 配置（首尾帧）
 */
function validateImageToVideoConfig(config: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. 校验 prompt
  if (!config.prompt || typeof config.prompt !== 'string') {
    errors.push("imageToVideoConfig.prompt 是必填字段");
  } else if (config.prompt.trim().length < 10) {
    errors.push("imageToVideoConfig.prompt 必须至少包含 10 个字符");
  }

  // 2. 校验 start_image_url（必填）
  if (!config.start_image_url || typeof config.start_image_url !== 'string') {
    errors.push("imageToVideoConfig.start_image_url 是必填字段");
  }

  // 3. 校验 duration 格式
  if (config.duration && typeof config.duration === 'string' && !["5", "10"].includes(config.duration)) {
    errors.push("imageToVideoConfig.duration 必须是字符串 '5' 或 '10'");
  }

  // 4. 建议在 prompt 中使用 @Image1 和 @Image2
  if (typeof config.prompt === 'string' && !config.prompt.includes("@Image1")) {
    warnings.push("建议在 prompt 中使用 @Image1 引用起始帧");
  }
  if (config.end_image_url && typeof config.prompt === 'string' && !config.prompt.includes("@Image2")) {
    warnings.push("提供了 end_image_url，建议在 prompt 中使用 @Image2 引用结束帧");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalizedConfig: {
      prompt: typeof config.prompt === 'string' ? config.prompt.trim() : '',
      start_image_url: config.start_image_url as string,
      end_image_url: config.end_image_url as string | undefined,
      duration: (config.duration as string) || "5",
      negative_prompt: config.negative_prompt as string | undefined,
    } as unknown as import("@/lib/utils/video-validation").ExtendedVideoConfig,
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

