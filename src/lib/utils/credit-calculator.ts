/**
 * 积分计算工具函数
 * 
 * 用于计算AI Agent操作的积分消耗
 */

import { CREDIT_COSTS } from "@/types/payment";
import type { FunctionCall } from "@/types/agent";

/**
 * 积分消耗明细
 */
export interface CreditBreakdown {
  functionCallId: string;
  functionName: string;
  credits: number;
  details?: string; // 如 "3张图片 × 8积分" 或 "5秒视频 × 20积分/秒"
}

/**
 * 积分计算结果
 */
export interface CreditCost {
  total: number;
  breakdown: CreditBreakdown[];
}

/**
 * 根据视频时长（毫秒）计算积分
 */
export function calculateVideoCredits(durationMs: number): { credits: number; seconds: number } {
  const seconds = durationMs / 1000;
  const klingDuration = seconds > 5 ? 10 : 5;
  const credits = klingDuration * CREDIT_COSTS.VIDEO_GENERATION_PER_SECOND;
  
  return { credits, seconds: klingDuration };
}

/**
 * 计算图片生成积分
 */
export function calculateImageCredits(numImages: number): { credits: number; numImages: number } {
  return {
    credits: numImages * CREDIT_COSTS.IMAGE_GENERATION,
    numImages,
  };
}

/**
 * 根据function call名称和参数估算积分（不查询数据库）
 * 
 * 注意：这个函数只能做简单估算，对于需要查询数据库的操作（如批量视频生成），
 * 需要使用 estimateActionCredits Server Action
 */
export function estimateFunctionCallCredits(
  functionCall: FunctionCall,
  additionalData?: {
    shotDurations?: Record<string, number>; // shotId -> duration in ms
    assetCounts?: Record<string, number>; // 用于批量资产生成
  }
): CreditBreakdown {
  const { name, parameters, id } = functionCall;

  try {
    switch (name) {
      case "generate_assets": {
        // 素材生成（单个或批量）
        const assets = parameters.assets as Array<{ numImages?: number }>;
        
        const totalImages = assets.reduce((sum, asset) => {
          return sum + (asset.numImages || 1);
        }, 0);
        
        const { credits } = calculateImageCredits(totalImages);
        
        return {
          functionCallId: id,
          functionName: name,
          credits,
          details: `${totalImages}张图片 × ${CREDIT_COSTS.IMAGE_GENERATION}积分`,
        };
      }

      case "generate_shot_images": {
        // 分镜图片生成
        const shotIds = JSON.parse(parameters.shotIds as string) as string[];
        const { credits } = calculateImageCredits(shotIds.length);
        
        return {
          functionCallId: id,
          functionName: name,
          credits,
          details: `${shotIds.length}张图片 × ${CREDIT_COSTS.IMAGE_GENERATION}积分`,
        };
      }

      default:
        // 其他操作不消耗积分（读操作、修改操作、删除操作）
        return {
          functionCallId: id,
          functionName: name,
          credits: 0,
        };
    }
  } catch (error) {
    console.error(`计算积分失败 [${name}]:`, error);
    // 解析失败，返回0（可能是读操作）
    return {
      functionCallId: id,
      functionName: name,
      credits: 0,
      details: "无法估算",
    };
  }
}

/**
 * 计算多个function calls的总积分
 */
export function calculateTotalCredits(
  functionCalls: FunctionCall[],
  additionalData?: {
    shotDurations?: Record<string, number>;
    assetCounts?: Record<string, number>;
  }
): CreditCost {
  const breakdown = functionCalls.map((fc) =>
    estimateFunctionCallCredits(fc, additionalData)
  );

  const total = breakdown.reduce((sum, item) => sum + item.credits, 0);

  return {
    total,
    breakdown,
  };
}

