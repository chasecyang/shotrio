// Kie.ai API 配置

export const KIE_API_BASE_URL = "https://api.kie.ai/api/v1";

export function getKieApiKey(): string {
  const apiKey = process.env.KIE_API_KEY;

  if (!apiKey) {
    throw new Error("KIE_API_KEY is not configured");
  }

  return apiKey;
}

/**
 * 获取 Kie 回调 URL
 * Suno API 要求必须提供回调 URL，但我们使用轮询方式获取结果
 * 如果配置了 KIE_CALLBACK_URL 则使用它，否则使用应用 URL 作为占位
 */
export function getKieCallbackUrl(): string {
  // 优先使用专门配置的回调 URL
  if (process.env.KIE_CALLBACK_URL) {
    return process.env.KIE_CALLBACK_URL;
  }

  // 使用应用 URL 作为占位（回调不会实际被使用，因为我们用轮询）
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (appUrl) {
    return `${appUrl}/api/webhooks/kie/callback`;
  }

  // 最后的后备值
  return "https://example.com/webhook/placeholder";
}
