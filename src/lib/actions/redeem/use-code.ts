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
      return { success: false, error: "NOT_LOGGED_IN" };
    }

    const userId = session.user.id;
    const trimmedCode = code.trim().toUpperCase();

    if (!trimmedCode) {
      return { success: false, error: "EMPTY_CODE" };
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
        throw new Error("CODE_NOT_FOUND");
      }

      // 2. Check if code is valid
      if (!redeemCode.isActive) {
        throw new Error("CODE_DISABLED");
      }

      // 3. Check if expired
      if (redeemCode.expiresAt && new Date() > redeemCode.expiresAt) {
        throw new Error("CODE_EXPIRED");
      }

      // 4. Check usage count
      if (redeemCode.usedCount >= redeemCode.maxUses) {
        throw new Error("CODE_MAX_USES_REACHED");
      }

      // 5. Check if user has already used this code
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
        throw new Error("CODE_ALREADY_USED");
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
        throw new Error(creditsResult.error || "ADD_CREDITS_FAILED");
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
    console.error("Failed to use redeem code:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "USE_CODE_FAILED",
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
      return { success: false, error: "NOT_LOGGED_IN" };
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
    console.error("Failed to get redeem records:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "GET_RECORDS_FAILED",
    };
  }
}

