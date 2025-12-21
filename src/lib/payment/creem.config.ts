/**
 * Creem支付配置
 * 
 * 环境变量：
 * - CREEM_API_KEY: Creem API密钥
 * - CREEM_WEBHOOK_SECRET: Webhook签名密钥
 * - NEXT_PUBLIC_CREEM_STORE_ID: 商店ID（前端使用）
 */

export const creemConfig = {
  apiKey: process.env.CREEM_API_KEY || "",
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET || "",
  storeId: process.env.NEXT_PUBLIC_CREEM_STORE_ID || "",
  testMode: process.env.NODE_ENV !== "production",
  
  // 回调URL
  successUrl: process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/credits/success`
    : "/credits/success",
  cancelUrl: process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/credits`
    : "/credits",
} as const;

// 验证配置
export function validateCreemConfig() {
  if (!creemConfig.apiKey) {
    throw new Error("Missing CREEM_API_KEY environment variable");
  }
  if (!creemConfig.webhookSecret) {
    console.warn("Missing CREEM_WEBHOOK_SECRET - webhooks will not be verified");
  }
  if (!creemConfig.storeId) {
    console.warn("Missing NEXT_PUBLIC_CREEM_STORE_ID");
  }
}

