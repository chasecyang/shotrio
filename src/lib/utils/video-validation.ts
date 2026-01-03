/**
 * 视频生成参数校验工具
 * 用于在 Agent 侧提前校验参数，避免无效请求到达 Worker
 */

import type { KlingO1ReferenceToVideoInput } from "@/lib/services/fal.service";

/**
 * 扩展的视频配置类型（支持 video_url）
 */
export interface ExtendedVideoConfig extends KlingO1ReferenceToVideoInput {
  video_url?: string; // 视频续写时使用
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];      // 阻断性错误
  warnings: string[];    // 警告信息
  normalizedConfig?: ExtendedVideoConfig; // 修正后的配置
}

/**
 * 校验 reference-to-video 配置参数（统一处理多图参考和视频续写）
 * 
 * 校验规则：
 * 1. prompt 非空且有意义（≥10个字符）
 * 2. 多图参考模式：图片总数 1-7 张
 * 3. 视频续写模式：video_url 必填，图片总数 ≤ 7 张（可选）
 * 4. elements 中每个元素必须有 reference_image_urls
 * 5. duration 为 "5" 或 "10"
 * 6. aspect_ratio 为 "16:9"、"9:16" 或 "1:1"
 */
export function validateReferenceToVideoConfig(
  config: ExtendedVideoConfig
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 判断是否为视频续写模式
  const isVideoToVideo = Boolean(config.video_url);

  // 1. 校验 prompt
  if (!config.prompt || typeof config.prompt !== 'string') {
    errors.push("缺少必填参数 prompt");
  } else if (config.prompt.trim().length < 10) {
    errors.push(`prompt 必须至少包含 10 个字符，当前只有 ${config.prompt.trim().length} 个字符`);
  }

  // 2. 视频续写模式：校验 video_url
  if (isVideoToVideo) {
    if (!config.video_url || typeof config.video_url !== 'string') {
      errors.push("视频续写模式下，video_url 是必填字段");
    }
    
    // 建议在 prompt 中使用 @Video1
    if (config.prompt && !config.prompt.includes("@Video1")) {
      warnings.push("建议在 prompt 中使用 @Video1 引用参考视频");
    }
  }

  // 3. 计算图片总数
  let totalImages = 0;
  const imageUrls = new Set<string>(); // 用于检测重复
  
  // 统计 elements 中的图片
  if (config.elements && Array.isArray(config.elements)) {
    config.elements.forEach((el, index) => {
      // frontal_image_url
      if (el.frontal_image_url) {
        totalImages += 1;
        imageUrls.add(el.frontal_image_url);
      } else {
        errors.push(`elements[${index}] 缺少 frontal_image_url`);
      }
      
      // reference_image_urls
      if (el.reference_image_urls && Array.isArray(el.reference_image_urls)) {
        totalImages += el.reference_image_urls.length;
        el.reference_image_urls.forEach((url) => imageUrls.add(url));
      }
    });
  }
  
  // 统计 image_urls
  if (config.image_urls && Array.isArray(config.image_urls)) {
    totalImages += config.image_urls.length;
    config.image_urls.forEach((url) => imageUrls.add(url));
  }

  // 4. 检查图片数量
  if (isVideoToVideo) {
    // 视频续写模式：图片可选，但不能超过 7 张
    if (totalImages > 7) {
      errors.push(
        `图片总数为 ${totalImages} 张，超过 API 限制（最多 7 张）。` +
        `请减少 elements 或 image_urls 中的图片数量。`
      );
    }
    if (totalImages === 0) {
      warnings.push("视频续写模式下未提供参考图片，将仅基于视频生成");
    }
  } else {
    // 多图参考模式：至少需要 1 张图片
    if (totalImages === 0) {
      errors.push("多图参考模式下，至少需要提供一张图片（通过 elements 或 image_urls）");
    } else if (totalImages > 7) {
      errors.push(
        `图片总数为 ${totalImages} 张，超过 API 限制（最多 7 张）。` +
        `请减少 elements 或 image_urls 中的图片数量。`
      );
    }
  }

  // 检查是否有重复图片（警告）
  if (imageUrls.size < totalImages) {
    warnings.push(`检测到重复的图片 URL（${totalImages - imageUrls.size} 处重复），建议去重以节省配额`);
  }

  // 5. 校验 elements 格式
  if (config.elements && Array.isArray(config.elements)) {
    config.elements.forEach((el, index) => {
      // 检查是否缺少 reference_image_urls
      if (!el.reference_image_urls || el.reference_image_urls.length === 0) {
        errors.push(
          `elements[${index}] 缺少 reference_image_urls。` +
          `根据 Kling O1 API 要求，elements 中的每个角色必须包含至少一张参考图。` +
          `如果只有一张图片，请将其放到 image_urls 中，不要使用 elements。`
        );
      }
      
      // 检查 URL 格式
      if (el.frontal_image_url && !isValidImageUrl(el.frontal_image_url)) {
        errors.push(`elements[${index}].frontal_image_url 的 URL 格式无效: ${el.frontal_image_url}`);
      }
      
      if (el.reference_image_urls) {
        el.reference_image_urls.forEach((url, refIndex) => {
          if (!isValidImageUrl(url)) {
            errors.push(`elements[${index}].reference_image_urls[${refIndex}] 的 URL 格式无效: ${url}`);
          }
        });
      }
    });
  }

  // 6. 校验 image_urls 格式
  if (config.image_urls && Array.isArray(config.image_urls)) {
    config.image_urls.forEach((url, index) => {
      if (!isValidImageUrl(url)) {
        errors.push(`image_urls[${index}] 的 URL 格式无效: ${url}`);
      }
    });
  }

  // 7. 校验 duration
  if (config.duration) {
    const validDurations = ["5", "10"];
    if (!validDurations.includes(config.duration)) {
      errors.push(
        `duration 必须为 "5" 或 "10"（字符串类型），当前值: "${config.duration}"`
      );
    }
  }

  // 8. 校验 aspect_ratio
  if (config.aspect_ratio) {
    const validRatios = ["16:9", "9:16", "1:1"];
    if (!validRatios.includes(config.aspect_ratio)) {
      errors.push(
        `aspect_ratio 必须为 ${validRatios.join("、")} 之一，当前值: "${config.aspect_ratio}"`
      );
    }
  }

  // 9. 标准化配置
  const normalizedConfig = {
    prompt: config.prompt?.trim(),
    duration: config.duration || "5",
    aspect_ratio: config.aspect_ratio || "16:9",
    negative_prompt: config.negative_prompt,
    ...(isVideoToVideo ? { video_url: config.video_url } : {}),
    ...(config.elements ? { elements: config.elements } : {}),
    ...(config.image_urls ? { image_urls: config.image_urls } : {}),
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalizedConfig,
  };
}

/**
 * 标准化 reference-to-video 配置
 * 
 * 自动修正：
 * 1. 移除 elements 中 reference_image_urls 为空的项，转移到 image_urls
 * 2. 设置默认值（duration="5", aspect_ratio="16:9"）
 * 3. 去重图片 URL
 */
export function normalizeReferenceToVideoConfig(
  config: KlingO1ReferenceToVideoInput
): KlingO1ReferenceToVideoInput {
  const normalized: KlingO1ReferenceToVideoInput = {
    prompt: config.prompt?.trim() || "",
    duration: config.duration || "5",
    aspect_ratio: config.aspect_ratio || "16:9",
    negative_prompt: config.negative_prompt,
  };

  // 处理 elements
  if (config.elements && config.elements.length > 0) {
    const validElements: typeof config.elements = [];
    const movedImages: string[] = [];

    config.elements.forEach((element) => {
      const hasValidReferences =
        element.reference_image_urls && element.reference_image_urls.length > 0;

      if (hasValidReferences) {
        // reference_image_urls 有内容，保留在 elements 中
        validElements.push({
          frontal_image_url: element.frontal_image_url,
          reference_image_urls: element.reference_image_urls,
        });
      } else {
        // reference_image_urls 为空，将 frontal_image_url 移到 image_urls
        if (element.frontal_image_url) {
          movedImages.push(element.frontal_image_url);
        }
      }
    });

    // 只在有有效 elements 时设置
    if (validElements.length > 0) {
      normalized.elements = validElements;
    }

    // 将移动的图片添加到 image_urls
    if (movedImages.length > 0) {
      normalized.image_urls = [
        ...(config.image_urls || []),
        ...movedImages,
      ];
    }
  }

  // 处理 image_urls（如果没有从 elements 移动过来的）
  if (!normalized.image_urls && config.image_urls) {
    normalized.image_urls = [...config.image_urls];
  }

  // 去重 image_urls
  if (normalized.image_urls) {
    normalized.image_urls = Array.from(new Set(normalized.image_urls));
  }

  return normalized;
}

/**
 * 检查 URL 是否为有效的图片 URL
 * 支持：
 * 1. HTTP/HTTPS URL
 * 2. R2 存储的 key（不以 http 开头的路径）
 */
function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const trimmedUrl = url.trim();
  if (trimmedUrl.length === 0) {
    return false;
  }

  // HTTP/HTTPS URL
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    try {
      new URL(trimmedUrl);
      return true;
    } catch {
      return false;
    }
  }

  // R2 key（路径格式，不包含特殊字符）
  // 简单检查：不包含空格、不以 / 开头
  return !trimmedUrl.includes(' ') && !trimmedUrl.startsWith('/');
}

/**
 * 计算配置中的图片总数（用于快速检查）
 */
export function countTotalImages(config: KlingO1ReferenceToVideoInput): number {
  let count = 0;

  if (config.elements) {
    config.elements.forEach((el) => {
      count += 1; // frontal_image_url
      count += el.reference_image_urls?.length || 0;
    });
  }

  count += config.image_urls?.length || 0;

  return count;
}

