"use server";

/**
 * 积分估算 Server Action
 * 
 * 查询数据库获取实际参数，计算准确的积分消耗
 */

import db from "@/lib/db";
import { shot } from "@/lib/db/schemas/project";
import { inArray } from "drizzle-orm";
import type { FunctionCall } from "@/types/agent";
import { calculateTotalCredits, type CreditCost } from "@/lib/utils/credit-calculator";

/**
 * 估算一组function calls的积分消耗
 * 
 * 会查询数据库获取shot的duration等实际数据
 */
export async function estimateActionCredits(
  functionCalls: FunctionCall[]
): Promise<{
  success: boolean;
  creditCost?: CreditCost;
  error?: string;
}> {
  try {
    // 收集需要查询的shot IDs
    const shotIdsToQuery = new Set<string>();

    for (const fc of functionCalls) {
      try {
        if (fc.name === "generate_videos") {
          const shotIds = fc.parameters.shotIds as string[];
          shotIds.forEach((id) => shotIdsToQuery.add(id));
        }
      } catch (error) {
        console.error(`解析参数失败 [${fc.name}]:`, error);
      }
    }

    // 查询shot数据
    const shotDurations: Record<string, number> = {};

    if (shotIdsToQuery.size > 0) {
      const shots = await db.query.shot.findMany({
        where: inArray(shot.id, Array.from(shotIdsToQuery)),
        columns: {
          id: true,
          duration: true,
        },
      });

      shots.forEach((s) => {
        shotDurations[s.id] = s.duration || 3000; // 默认3秒
      });

      // 对于没有查询到的shot，使用保守估算（10秒）
      shotIdsToQuery.forEach((shotId) => {
        if (!shotDurations[shotId]) {
          shotDurations[shotId] = 10000; // 保守估算10秒
        }
      });
    }

    // 计算积分
    const creditCost = calculateTotalCredits(functionCalls, {
      shotDurations,
    });

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
