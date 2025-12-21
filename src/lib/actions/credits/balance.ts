"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { credits } from "@/lib/db/schemas/payment";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { CreditAccount } from "@/types/payment";

/**
 * 获取用户积分余额
 */
export async function getCreditBalance(): Promise<{
  success: boolean;
  balance?: CreditAccount;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    // 查询用户积分账户
    const [account] = await db
      .select()
      .from(credits)
      .where(eq(credits.userId, session.user.id))
      .limit(1);

    // 如果不存在，创建新账户
    if (!account) {
      const newAccount = {
        id: nanoid(),
        userId: session.user.id,
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(credits).values(newAccount);

      return {
        success: true,
        balance: newAccount,
      };
    }

    return {
      success: true,
      balance: account as CreditAccount,
    };
  } catch (error) {
    console.error("获取积分余额失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取积分余额失败",
    };
  }
}

/**
 * 检查用户积分是否充足
 */
export async function hasEnoughCredits(amount: number): Promise<{
  success: boolean;
  hasEnough: boolean;
  currentBalance?: number;
  error?: string;
}> {
  try {
    const result = await getCreditBalance();

    if (!result.success || !result.balance) {
      return {
        success: false,
        hasEnough: false,
        error: result.error || "无法获取积分余额",
      };
    }

    return {
      success: true,
      hasEnough: result.balance.balance >= amount,
      currentBalance: result.balance.balance,
    };
  } catch (error) {
    console.error("检查积分余额失败:", error);
    return {
      success: false,
      hasEnough: false,
      error: error instanceof Error ? error.message : "检查积分余额失败",
    };
  }
}

