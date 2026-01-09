"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { redeemCodes, redeemRecords, TransactionType } from "@/lib/db/schemas/payment";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { addCredits } from "@/lib/actions/credits/spend";

/**
 * 使用兑换码
 */
export async function useRedeemCode(code: string): Promise<{
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
    const trimmedCode = code.trim().toUpperCase();

    if (!trimmedCode) {
      return { success: false, error: "请输入兑换码" };
    }

    // 使用事务确保原子性
    const result = await db.transaction(async (tx) => {
      // 1. 查询兑换码
      const [redeemCode] = await tx
        .select()
        .from(redeemCodes)
        .where(eq(redeemCodes.code, trimmedCode))
        .limit(1);

      if (!redeemCode) {
        throw new Error("兑换码不存在");
      }

      // 2. 检查兑换码是否有效
      if (!redeemCode.isActive) {
        throw new Error("兑换码已被禁用");
      }

      // 3. 检查是否过期
      if (redeemCode.expiresAt && new Date() > redeemCode.expiresAt) {
        throw new Error("兑换码已过期");
      }

      // 4. 检查使用次数
      if (redeemCode.usedCount >= redeemCode.maxUses) {
        throw new Error("兑换码已达到最大使用次数");
      }

      // 5. 检查用户是否已经使用过
      const [existingRecord] = await tx
        .select()
        .from(redeemRecords)
        .where(
          and(
            eq(redeemRecords.userId, userId),
            eq(redeemRecords.codeId, redeemCode.id)
          )
        )
        .limit(1);

      if (existingRecord) {
        throw new Error("您已经使用过该兑换码");
      }

      // 6. 增加积分
      const creditsResult = await addCredits({
        userId,
        amount: redeemCode.credits,
        type: TransactionType.REDEEM,
        description: `descriptions.redeem.code`,
        metadata: {
          codeId: redeemCode.id,
          code: trimmedCode,
          translationParams: { code: trimmedCode },
        },
      });

      if (!creditsResult.success) {
        throw new Error(creditsResult.error || "增加积分失败");
      }

      // 7. 记录兑换
      await tx.insert(redeemRecords).values({
        id: nanoid(),
        userId,
        codeId: redeemCode.id,
        credits: redeemCode.credits,
        redeemedAt: new Date(),
      });

      // 8. 更新使用次数
      await tx
        .update(redeemCodes)
        .set({
          usedCount: redeemCode.usedCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(redeemCodes.id, redeemCode.id));

      return { credits: redeemCode.credits };
    });

    return {
      success: true,
      credits: result.credits,
    };
  } catch (error) {
    console.error("使用兑换码失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "使用兑换码失败",
    };
  }
}

/**
 * 获取用户的兑换记录
 */
export async function getUserRedeemRecords(): Promise<{
  success: boolean;
  records?: Array<{
    id: string;
    code: string;
    credits: number;
    redeemedAt: Date;
    description?: string | null;
  }>;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    // 联查兑换记录和兑换码信息
    const records = await db
      .select({
        id: redeemRecords.id,
        code: redeemCodes.code,
        credits: redeemRecords.credits,
        redeemedAt: redeemRecords.redeemedAt,
        description: redeemCodes.description,
      })
      .from(redeemRecords)
      .innerJoin(redeemCodes, eq(redeemRecords.codeId, redeemCodes.id))
      .where(eq(redeemRecords.userId, session.user.id))
      .orderBy(redeemRecords.redeemedAt);

    return {
      success: true,
      records,
    };
  } catch (error) {
    console.error("获取兑换记录失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取兑换记录失败",
    };
  }
}

