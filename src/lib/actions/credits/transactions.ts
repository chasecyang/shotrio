"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import {
  creditTransactions,
  credits,
  TransactionType,
} from "@/lib/db/schemas/payment";
import { eq, desc, count, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { CreditTransaction } from "@/types/payment";

/**
 * 获取用户积分交易记录
 */
export async function getCreditTransactions(options?: {
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  transactions?: CreditTransaction[];
  total?: number;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    // 查询交易记录
    const transactions = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, session.user.id))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    // 查询总数
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, session.user.id));

    return {
      success: true,
      transactions: transactions as CreditTransaction[],
      total: Number(totalCount),
    };
  } catch (error) {
    console.error("获取交易记录失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取交易记录失败",
    };
  }
}

/**
 * 根据订单ID获取交易记录
 */
export async function getTransactionsByOrderId(
  orderId: string
): Promise<{
  success: boolean;
  transactions?: CreditTransaction[];
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    const transactions = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.orderId, orderId))
      .orderBy(desc(creditTransactions.createdAt));

    return {
      success: true,
      transactions: transactions as CreditTransaction[],
    };
  } catch (error) {
    console.error("获取订单交易记录失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取订单交易记录失败",
    };
  }
}

const SIGNUP_BONUS_CREDITS = 200;

/**
 * 检查用户是否已领取注册奖励
 */
export async function hasClaimedWelcomeBonus(): Promise<{
  success: boolean;
  claimed?: boolean;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    // 检查是否有 signup_bonus 交易记录
    const [result] = await db
      .select({ count: count() })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, session.user.id),
          eq(creditTransactions.description, "signup_bonus")
        )
      );

    return {
      success: true,
      claimed: Number(result?.count ?? 0) > 0,
    };
  } catch (error) {
    console.error("检查注册奖励状态失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "检查注册奖励状态失败",
    };
  }
}

/**
 * 领取注册奖励积分
 */
export async function claimWelcomeBonus(): Promise<{
  success: boolean;
  credits?: number;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    const userId = session.user.id;

    // 检查是否已领取
    const [existingBonus] = await db
      .select({ count: count() })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, userId),
          eq(creditTransactions.description, "signup_bonus")
        )
      );

    if (Number(existingBonus?.count ?? 0) > 0) {
      return { success: false, error: "已领取过注册奖励" };
    }

    const now = new Date();

    // 检查是否有积分账户
    const [existingCredits] = await db
      .select()
      .from(credits)
      .where(eq(credits.userId, userId));

    if (existingCredits) {
      // 更新现有积分账户
      await db
        .update(credits)
        .set({
          balance: existingCredits.balance + SIGNUP_BONUS_CREDITS,
          totalEarned: existingCredits.totalEarned + SIGNUP_BONUS_CREDITS,
          updatedAt: now,
        })
        .where(eq(credits.userId, userId));

      // 记录交易
      await db.insert(creditTransactions).values({
        id: nanoid(),
        userId,
        type: TransactionType.BONUS,
        amount: SIGNUP_BONUS_CREDITS,
        balance: existingCredits.balance + SIGNUP_BONUS_CREDITS,
        description: "signup_bonus",
        createdAt: now,
      });
    } else {
      // 创建新积分账户
      await db.insert(credits).values({
        id: nanoid(),
        userId,
        balance: SIGNUP_BONUS_CREDITS,
        totalEarned: SIGNUP_BONUS_CREDITS,
        totalSpent: 0,
        createdAt: now,
        updatedAt: now,
      });

      // 记录交易
      await db.insert(creditTransactions).values({
        id: nanoid(),
        userId,
        type: TransactionType.BONUS,
        amount: SIGNUP_BONUS_CREDITS,
        balance: SIGNUP_BONUS_CREDITS,
        description: "signup_bonus",
        createdAt: now,
      });
    }

    console.log(`[Credits] User ${userId} claimed welcome bonus: ${SIGNUP_BONUS_CREDITS} credits`);

    return {
      success: true,
      credits: SIGNUP_BONUS_CREDITS,
    };
  } catch (error) {
    console.error("领取注册奖励失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "领取注册奖励失败",
    };
  }
}

