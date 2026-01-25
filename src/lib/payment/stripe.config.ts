/**
 * Stripe支付配置
 *
 * 环境变量：
 * - STRIPE_SECRET_KEY: Stripe API密钥（服务端）
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Stripe公钥（客户端）
 * - STRIPE_WEBHOOK_SECRET: Webhook签名密钥
 */

import Stripe from "stripe";

// Stripe 实例（服务端使用）- 延迟初始化
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("Missing STRIPE_SECRET_KEY environment variable");
    }
    stripeInstance = new Stripe(secretKey, {
      typescript: true,
    });
  }
  return stripeInstance;
}

export const stripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY || "",
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",

  // 回调URL
  successUrl: process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/credits/success?session_id={CHECKOUT_SESSION_ID}`
    : "/credits/success?session_id={CHECKOUT_SESSION_ID}",
  cancelUrl: process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/credits`
    : "/credits",
} as const;

// 验证配置
export function validateStripeConfig() {
  if (!stripeConfig.secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable");
  }
  if (!stripeConfig.webhookSecret) {
    console.warn(
      "Missing STRIPE_WEBHOOK_SECRET - webhooks will not be verified"
    );
  }
}
