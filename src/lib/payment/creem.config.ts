/**
 * Creem支付配置
 * 
 * 环境变量：
 * - CREEM_API_KEY: Creem API密钥
 * - CREEM_WEBHOOK_SECRET: Webhook签名密钥
 * - NEXT_PUBLIC_CREEM_STORE_ID: 商店ID（前端使用）
 */

import { PackageType } from "@/lib/db/schemas/payment";

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

export const creemProductIds: Record<PackageType, string> = {
  [PackageType.STARTER]: "prod_6DIHacmGE9koCQNfmmDK1p",
  [PackageType.BASIC]: "prod_1tFUzaPotYr7m12MyYZQO0",
  [PackageType.STANDARD]: "prod_6UZLoMEnepGGhJQi5Z7Vcj",
  [PackageType.PRO]: "prod_3wkilc57omaCqVeIbVgJq1",
  [PackageType.ULTIMATE]: "prod_4QxqTZQw6owHyXCwbhLqRg",
};

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
