// Kie.ai API 配置

export const KIE_API_BASE_URL = "https://api.kie.ai/api/v1";

export function getKieApiKey(): string {
  const apiKey = process.env.KIE_API_KEY;

  if (!apiKey) {
    throw new Error("KIE_API_KEY is not configured");
  }

  return apiKey;
}
