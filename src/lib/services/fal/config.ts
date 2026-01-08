// Fal.ai API 配置
import { fal } from "@fal-ai/client";

let isConfigured = false;

/**
 * 配置 fal 客户端（幂等）
 */
export function configureFal(): void {
  if (isConfigured) return;

  const falKey = process.env.FAL_KEY;

  if (!falKey) {
    throw new Error("FAL_KEY is not configured");
  }

  fal.config({
    credentials: falKey,
  });

  isConfigured = true;
}
