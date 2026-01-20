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
 */
export async function validateFunctionParameters(
  functionName: string,
  argumentsJson: string
): Promise<ValidationResult> {
  try {
    const params = JSON.parse(argumentsJson);

    // 生成类
    if (functionName === "generate_video_asset") {
      return validateGenerateVideoParams(params);
    }
    if (functionName === "generate_image_asset") {
      return validateGenerateImageParams(params);
    }

    // 音频生成类
    if (
      ["generate_sound_effect", "generate_bgm", "generate_dialogue"].includes(
        functionName
      )
    ) {
      return validateAudioGenerationParams(functionName, params);
    }

    // 时间轴类
    if (
      ["add_clip", "remove_clip", "update_clip", "add_audio_track"].includes(
        functionName
      )
    ) {
      return validateTimelineParams(functionName, params);
    }

    // 资产操作类
    if (["update_asset", "delete_asset"].includes(functionName)) {
      return validateAssetParams(functionName, params);
    }

    // 文本资产类
    if (functionName === "create_text_asset") {
      return validateTextAssetParams(params);
    }

    // 项目信息类
    if (functionName === "set_project_info") {
      return validateSetProjectInfoParams(params);
    }

    // 查询类函数（无需严格校验）
    return { valid: true, errors: [], warnings: [] };
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
 */
function validateGenerateVideoParams(
  params: Record<string, unknown>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 校验 prompt（必填）
  if (!params.prompt || typeof params.prompt !== "string") {
    errors.push("prompt 是必填字段");
  } else if (params.prompt.trim().length < 10) {
    errors.push("prompt 必须至少包含 10 个字符");
  }

  // 校验 start_image_url（必填）
  if (!params.start_image_url || typeof params.start_image_url !== "string") {
    errors.push("start_image_url 是必填字段");
  }

  // 校验 aspect_ratio 格式
  if (
    params.aspect_ratio &&
    typeof params.aspect_ratio === "string" &&
    !["16:9", "9:16"].includes(params.aspect_ratio)
  ) {
    errors.push("aspect_ratio 必须是 '16:9' 或 '9:16'");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalizedConfig: {
      prompt: typeof params.prompt === "string" ? params.prompt.trim() : "",
      start_image_url: params.start_image_url as string,
      end_image_url: params.end_image_url as string | undefined,
      aspect_ratio: params.aspect_ratio as "16:9" | "9:16" | undefined,
      negative_prompt: params.negative_prompt as string | undefined,
    },
  };
}

/**
 * 校验 generate_image_asset 参数
 */
function validateGenerateImageParams(
  params: Record<string, unknown>
): ValidationResult {
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

  params.assets.forEach((asset: Record<string, unknown>, index: number) => {
    if (!asset.prompt || typeof asset.prompt !== "string") {
      errors.push(`assets[${index}] 缺少必填参数 prompt`);
    } else if (asset.prompt.trim().length < 5) {
      errors.push(`assets[${index}].prompt 必须至少包含 5 个字符`);
    }

    if (asset.tags && !Array.isArray(asset.tags)) {
      errors.push(`assets[${index}].tags 必须是数组类型`);
    }

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
 * 校验音频生成参数
 */
function validateAudioGenerationParams(
  functionName: string,
  params: Record<string, unknown>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (functionName) {
    case "generate_sound_effect": {
      const prompt = params.prompt as string | undefined;
      if (!prompt || prompt.length < 3) {
        errors.push("prompt 不能为空且至少 3 个字符");
      }
      if (params.duration !== undefined) {
        const duration = params.duration as number;
        if (duration < 0.5 || duration > 22) {
          errors.push("duration 必须在 0.5-22 秒之间");
        }
      }
      break;
    }
    case "generate_bgm": {
      const prompt = params.prompt as string | undefined;
      if (!prompt || prompt.length < 5) {
        errors.push("prompt 不能为空且至少 5 个字符");
      }
      break;
    }
    case "generate_dialogue": {
      if (!params.text || (params.text as string).length < 1) {
        errors.push("text 不能为空");
      }
      if (!params.voice_id) {
        errors.push("voice_id 不能为空");
      }
      // voice_id 格式验证延迟到执行时（需要动态导入）
      break;
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * 校验时间轴操作参数
 */
function validateTimelineParams(
  functionName: string,
  params: Record<string, unknown>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (functionName) {
    case "add_clip": {
      if (!params.assetId || typeof params.assetId !== "string") {
        errors.push("assetId 是必填字段");
      }
      if (params.duration !== undefined && typeof params.duration !== "number") {
        errors.push("duration 必须是数字类型");
      }
      if (
        params.trackIndex !== undefined &&
        typeof params.trackIndex !== "number"
      ) {
        errors.push("trackIndex 必须是数字类型");
      }
      break;
    }
    case "remove_clip": {
      if (!params.clipId || typeof params.clipId !== "string") {
        errors.push("clipId 是必填字段");
      }
      break;
    }
    case "update_clip": {
      if (!params.clipId || typeof params.clipId !== "string") {
        errors.push("clipId 是必填字段");
      }
      break;
    }
    case "add_audio_track": {
      // name 是可选的
      if (params.name !== undefined && typeof params.name !== "string") {
        errors.push("name 必须是字符串类型");
      }
      break;
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * 校验资产操作参数
 */
function validateAssetParams(
  functionName: string,
  params: Record<string, unknown>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (functionName) {
    case "update_asset": {
      if (!params.updates || !Array.isArray(params.updates)) {
        errors.push("updates 是必填数组字段");
      } else if (params.updates.length === 0) {
        errors.push("updates 数组不能为空");
      } else {
        params.updates.forEach(
          (update: Record<string, unknown>, index: number) => {
            if (!update.assetId || typeof update.assetId !== "string") {
              errors.push(`updates[${index}].assetId 是必填字段`);
            }
          }
        );
      }
      break;
    }
    case "delete_asset": {
      if (!params.assetIds || !Array.isArray(params.assetIds)) {
        errors.push("assetIds 是必填数组字段");
      } else if (params.assetIds.length === 0) {
        errors.push("assetIds 数组不能为空");
      }
      break;
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * 校验文本资产参数
 */
function validateTextAssetParams(
  params: Record<string, unknown>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!params.name || typeof params.name !== "string") {
    errors.push("name 是必填字符串字段");
  }
  if (!params.content || typeof params.content !== "string") {
    errors.push("content 是必填字符串字段");
  }
  if (params.tags && !Array.isArray(params.tags)) {
    errors.push("tags 必须是数组类型");
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * 校验 set_project_info 参数
 */
function validateSetProjectInfoParams(
  params: Record<string, unknown>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const hasTitle = params.title !== undefined;
  const hasDescription = params.description !== undefined;
  const hasStyleId = params.styleId !== undefined;

  // 至少需要一个字段
  if (!hasTitle && !hasDescription && !hasStyleId) {
    errors.push("至少需要提供 title、description 或 styleId 中的一个字段");
  }

  // 校验各字段类型
  if (hasTitle && typeof params.title !== "string") {
    errors.push("title 必须是字符串");
  }
  if (hasDescription && typeof params.description !== "string") {
    errors.push("description 必须是字符串");
  }
  if (hasStyleId && typeof params.styleId !== "string") {
    errors.push("styleId 必须是字符串");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
