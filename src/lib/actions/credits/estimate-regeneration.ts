"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { CREDIT_COSTS } from "@/types/payment";
import type { AudioMeta } from "@/types/asset";

/**
 * 估算重新生成资产的积分成本
 */
export async function estimateRegenerationCost(assetId: string): Promise<{
  success: boolean;
  cost?: number;
  details?: string;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "未登录" };
    }

    // 获取资产完整数据
    const { getAssetWithFullData } = await import("../asset/get-asset");
    const assetResult = await getAssetWithFullData(assetId);

    if (!assetResult.success || !assetResult.asset) {
      return { success: false, error: assetResult.error || "素材不存在" };
    }

    const asset = assetResult.asset;

    // 验证是否为生成的资产
    if (asset.sourceType !== "generated") {
      return { success: false, error: "只能重新生成 AI 生成的素材" };
    }

    // 根据资产类型计算成本
    let cost = 0;
    let details = "";

    switch (asset.assetType) {
      case "image":
        cost = CREDIT_COSTS.IMAGE_GENERATION;
        details = `1张图片 × ${CREDIT_COSTS.IMAGE_GENERATION}积分`;
        break;

      case "video": {
        // 计算视频时长（秒）
        const durationMs = asset.duration || 8000; // 默认8秒
        const durationSec = Math.ceil(durationMs / 1000);
        cost = durationSec * CREDIT_COSTS.VIDEO_GENERATION_PER_SECOND;
        details = `${durationSec}秒视频 × ${CREDIT_COSTS.VIDEO_GENERATION_PER_SECOND}积分/秒`;
        break;
      }

      case "audio": {
        // 根据 meta.purpose 判断是音效还是音乐
        let audioMeta: AudioMeta | null = null;
        if (asset.meta) {
          try {
            audioMeta = typeof asset.meta === "string"
              ? JSON.parse(asset.meta)
              : asset.meta;
          } catch (e) {
            console.error("解析音频 meta 失败:", e);
          }
        }

        const purpose = audioMeta?.purpose;

        if (purpose === "bgm") {
          cost = CREDIT_COSTS.MUSIC_GENERATION;
          details = "背景音乐生成";
        } else if (purpose === "sound_effect") {
          cost = CREDIT_COSTS.SOUND_EFFECT_GENERATION;
          details = "音效生成";
        } else if (purpose === "voiceover") {
          // 配音暂时按音效计费
          cost = CREDIT_COSTS.SOUND_EFFECT_GENERATION;
          details = "配音生成";
        } else {
          // 如果没有 purpose，根据时长判断
          const durationMs = asset.duration || 0;
          if (durationMs > 10000) {
            cost = CREDIT_COSTS.MUSIC_GENERATION;
            details = "背景音乐生成";
          } else {
            cost = CREDIT_COSTS.SOUND_EFFECT_GENERATION;
            details = "音效生成";
          }
        }
        break;
      }

      default:
        return { success: false, error: "不支持的素材类型" };
    }

    return {
      success: true,
      cost,
      details,
    };
  } catch (error) {
    console.error("估算重新生成成本失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "估算成本失败",
    };
  }
}
