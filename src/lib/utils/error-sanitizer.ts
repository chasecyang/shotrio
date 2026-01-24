/**
 * 错误信息脱敏工具
 * 将技术错误消息转换为用户友好的消息
 * 原始错误仍保留在数据库和日志中供调试
 */

// 错误模式映射表
const ERROR_PATTERNS: Array<{ pattern: RegExp; messageKey: string }> = [
  // OpenAI 内容审核错误
  {
    pattern: /violate.*OpenAI.*guardrails|similarity to third-party content/i,
    messageKey: "errors.generation.contentPolicy"
  },

  // Veo 名人/公众人物过滤错误
  {
    pattern: /PROMINENT_PEOPLE_FILTER_FAILED|prominent people/i,
    messageKey: "errors.generation.prominentPeopleFilter"
  },

  // 超时类错误
  { pattern: /超时（?已尝试.*次）?/i, messageKey: "errors.generation.timeout" },
  { pattern: /timeout/i, messageKey: "errors.generation.timeout" },

  // 网络类错误
  { pattern: /网络错误/i, messageKey: "errors.generation.network" },
  { pattern: /ECONNRESET|ETIMEDOUT/i, messageKey: "errors.generation.network" },
  { pattern: /fetch failed/i, messageKey: "errors.generation.network" },
  { pattern: /连续.*错误.*放弃重试/i, messageKey: "errors.generation.network" },

  // API/服务失败（脱敏内部服务名：Kie.ai、Suno、Veo 等）
  { pattern: /API failed/i, messageKey: "errors.generation.serviceFailed" },
  { pattern: /API 失败/i, messageKey: "errors.generation.serviceFailed" },
  { pattern: /Kie\.ai/i, messageKey: "errors.generation.serviceFailed" },
  { pattern: /Suno/i, messageKey: "errors.generation.serviceFailed" },
  { pattern: /Veo/i, messageKey: "errors.generation.serviceFailed" },

  // 积分不足
  {
    pattern: /积分不足/i,
    messageKey: "errors.generation.insufficientCredits",
  },
  {
    pattern: /insufficient.*credits/i,
    messageKey: "errors.generation.insufficientCredits",
  },

  // 权限错误
  { pattern: /无权访问/i, messageKey: "errors.generation.unauthorized" },
  { pattern: /未授权/i, messageKey: "errors.generation.unauthorized" },
  { pattern: /unauthorized/i, messageKey: "errors.generation.unauthorized" },

  // 资源不存在
  { pattern: /不存在/i, messageKey: "errors.generation.resourceNotFound" },
  { pattern: /未找到/i, messageKey: "errors.generation.resourceNotFound" },
  { pattern: /not found/i, messageKey: "errors.generation.resourceNotFound" },

  // 上传失败
  { pattern: /上传.*失败/i, messageKey: "errors.generation.uploadFailed" },
  { pattern: /upload.*failed/i, messageKey: "errors.generation.uploadFailed" },

  // 生成失败（通用）
  { pattern: /生成失败/i, messageKey: "errors.generation.generationFailed" },
  {
    pattern: /generation.*failed/i,
    messageKey: "errors.generation.generationFailed",
  },
];

/**
 * 获取错误消息对应的国际化 key
 * @param errorMessage 原始技术错误消息
 * @returns 对应的国际化消息 key
 */
export function getErrorMessageKey(
  errorMessage: string | null | undefined
): string {
  if (!errorMessage) {
    return "errors.generation.unknown";
  }

  for (const { pattern, messageKey } of ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return messageKey;
    }
  }

  return "errors.generation.unknown";
}
