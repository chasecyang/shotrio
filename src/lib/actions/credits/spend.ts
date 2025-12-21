"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { credits, creditTransactions, TransactionType } from "@/lib/db/schemas/payment";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * 消费积分（原子操作）
 */
export async function spendCredits(params: {
  amount: number;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  newBalance?: number;
  transactionId?: string;
  error?: string;
}> {
  const { amount, description, metadata } = params;

  if (amount <= 0) {
    return { success: false, error: "消费金额必须大于0" };
  }

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    const userId = session.user.id;

    // 使用事务确保原子性
    const result = await db.transaction(async (tx) => {
      // 1. 锁定并获取用户积分账户
      const [account] = await tx
        .select()
        .from(credits)
        .where(eq(credits.userId, userId))
        .limit(1);

      if (!account) {
        throw new Error("积分账户不存在");
      }

      // 2. 检查余额是否充足
      if (account.balance < amount) {
        throw new Error(
          `积分不足，当前余额：${account.balance}，需要：${amount}`
        );
      }

      // 3. 扣除积分
      const newBalance = account.balance - amount;
      const newTotalSpent = account.totalSpent + amount;

      await tx
        .update(credits)
        .set({
          balance: newBalance,
          totalSpent: newTotalSpent,
          updatedAt: new Date(),
        })
        .where(eq(credits.userId, userId));

      // 4. 记录交易
      const transactionId = nanoid();
      await tx.insert(creditTransactions).values({
        id: transactionId,
        userId,
        type: TransactionType.SPEND,
        amount: -amount, // 负数表示消费
        balance: newBalance,
        description,
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: new Date(),
      });

      return { newBalance, transactionId };
    });

    return {
      success: true,
      newBalance: result.newBalance,
      transactionId: result.transactionId,
    };
  } catch (error) {
    console.error("消费积分失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "消费积分失败",
    };
  }
}

/**
 * 增加积分（用于充值、奖励、兑换等）
 */
export async function addCredits(params: {
  userId: string;
  amount: number;
  type: TransactionType;
  description: string;
  orderId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  newBalance?: number;
  transactionId?: string;
  error?: string;
}> {
  const { userId, amount, type, description, orderId, metadata } = params;

  if (amount <= 0) {
    return { success: false, error: "增加金额必须大于0" };
  }

  try {
    // 使用事务确保原子性
    const result = await db.transaction(async (tx) => {
      // 1. 获取或创建积分账户
      let [account] = await tx
        .select()
        .from(credits)
        .where(eq(credits.userId, userId))
        .limit(1);

      if (!account) {
        // 创建新账户
        const newAccountId = nanoid();
        await tx.insert(credits).values({
          id: newAccountId,
          userId,
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        [account] = await tx
          .select()
          .from(credits)
          .where(eq(credits.userId, userId))
          .limit(1);
      }

      // 2. 增加积分
      const newBalance = account.balance + amount;
      const newTotalEarned = account.totalEarned + amount;

      await tx
        .update(credits)
        .set({
          balance: newBalance,
          totalEarned: newTotalEarned,
          updatedAt: new Date(),
        })
        .where(eq(credits.userId, userId));

      // 3. 记录交易
      const transactionId = nanoid();
      await tx.insert(creditTransactions).values({
        id: transactionId,
        userId,
        type,
        amount, // 正数表示获得
        balance: newBalance,
        orderId: orderId || null,
        description,
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: new Date(),
      });

      return { newBalance, transactionId };
    });

    return {
      success: true,
      newBalance: result.newBalance,
      transactionId: result.transactionId,
    };
  } catch (error) {
    console.error("增加积分失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "增加积分失败",
    };
  }
}

/**
 * 退款积分（将消费的积分退回）
 */
export async function refundCredits(params: {
  userId: string;
  amount: number;
  description: string;
  orderId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  newBalance?: number;
  transactionId?: string;
  error?: string;
}> {
  return addCredits({
    ...params,
    type: TransactionType.REFUND,
  });
}

