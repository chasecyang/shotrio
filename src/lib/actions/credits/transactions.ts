"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { creditTransactions } from "@/lib/db/schemas/payment";
import { eq, desc, count } from "drizzle-orm";
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

