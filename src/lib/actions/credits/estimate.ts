"use server";

/**
 * 积分估算 Server Action
 * 
 * 计算 function calls 的积分消耗
 */

import type { FunctionCall } from "@/types/agent";
import { calculateTotalCredits, type CreditCost } from "@/lib/utils/credit-calculator";

/**
 * 估算一组function calls的积分消耗
 */
export async function estimateActionCredits(
  functionCalls: FunctionCall[]
): Promise<{
  success: boolean;
  creditCost?: CreditCost;
  error?: string;
}> {
  try {
    // 计算积分
    const creditCost = calculateTotalCredits(functionCalls);

    return {
      success: true,
      creditCost,
    };
  } catch (error) {
    console.error("估算积分失败:", error);
    
    // 失败时返回保守估算
    const creditCost = calculateTotalCredits(functionCalls);
    
    return {
      success: true,
      creditCost,
    };
  }
}
