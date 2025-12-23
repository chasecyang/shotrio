"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { redeemCodes, redeemRecords } from "@/lib/db/schemas/payment";
import { Role } from "@/lib/db/schemas/auth";
import { eq, desc, count } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * 生成兑换码
 * 仅管理员可用
 */
export async function generateRedeemCode(params: {
  credits: number;
  maxUses?: number;
  expiresAt?: Date;
  description?: string;
  customCode?: string;
}): Promise<{
  success: boolean;
  code?: string;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    // 检查管理员权限
    if (session.user.role !== Role.ADMIN) {
      return { success: false, error: "权限不足" };
    }

    const { credits, maxUses = 1, expiresAt, description, customCode } = params;

    if (credits <= 0) {
      return { success: false, error: "积分数量必须大于0" };
    }

    if (maxUses <= 0) {
      return { success: false, error: "最大使用次数必须大于0" };
    }

    // 生成兑换码
    const code = customCode
      ? customCode.trim().toUpperCase()
      : generateRandomCode();

    // 检查是否重复
    const [existing] = await db
      .select()
      .from(redeemCodes)
      .where(eq(redeemCodes.code, code))
      .limit(1);

    if (existing) {
      return { success: false, error: "兑换码已存在" };
    }

    // 创建兑换码
    await db.insert(redeemCodes).values({
      id: nanoid(),
      code,
      credits,
      maxUses,
      usedCount: 0,
      expiresAt: expiresAt || null,
      createdBy: session.user.id,
      isActive: true,
      description: description || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      success: true,
      code,
    };
  } catch (error) {
    console.error("生成兑换码失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "生成兑换码失败",
    };
  }
}

/**
 * 批量生成兑换码
 * 仅管理员可用
 */
export async function batchGenerateRedeemCodes(params: {
  count: number;
  credits: number;
  maxUses?: number;
  expiresAt?: Date;
  description?: string;
}): Promise<{
  success: boolean;
  codes?: string[];
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    // 检查管理员权限
    if (session.user.role !== Role.ADMIN) {
      return { success: false, error: "权限不足" };
    }

    const { count, credits, maxUses = 1, expiresAt, description } = params;

    if (count <= 0 || count > 1000) {
      return { success: false, error: "生成数量必须在1-1000之间" };
    }

    if (credits <= 0) {
      return { success: false, error: "积分数量必须大于0" };
    }

    // 批量生成
    const codes: string[] = [];
    const values = [];

    for (let i = 0; i < count; i++) {
      const code = generateRandomCode();
      codes.push(code);

      values.push({
        id: nanoid(),
        code,
        credits,
        maxUses,
        usedCount: 0,
        expiresAt: expiresAt || null,
        createdBy: session.user.id,
        isActive: true,
        description: description || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await db.insert(redeemCodes).values(values);

    return {
      success: true,
      codes,
    };
  } catch (error) {
    console.error("批量生成兑换码失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "批量生成兑换码失败",
    };
  }
}

/**
 * 获取所有兑换码列表
 * 仅管理员可用
 */
export async function getAllRedeemCodes(options?: {
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  codes?: Array<{
    id: string;
    code: string;
    credits: number;
    maxUses: number;
    usedCount: number;
    expiresAt: Date | null;
    isActive: boolean;
    description: string | null;
    createdAt: Date;
  }>;
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

    // 检查管理员权限
    if (session.user.role !== Role.ADMIN) {
      return { success: false, error: "权限不足" };
    }

    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const codes = await db
      .select()
      .from(redeemCodes)
      .orderBy(desc(redeemCodes.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(redeemCodes);

    return {
      success: true,
      codes: codes.map((code) => ({
        id: code.id,
        code: code.code,
        credits: code.credits,
        maxUses: code.maxUses,
        usedCount: code.usedCount,
        expiresAt: code.expiresAt,
        isActive: code.isActive,
        description: code.description,
        createdAt: code.createdAt,
      })),
      total: Number(total),
    };
  } catch (error) {
    console.error("获取兑换码列表失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取兑换码列表失败",
    };
  }
}

/**
 * 更新兑换码状态
 * 仅管理员可用
 */
export async function updateRedeemCodeStatus(params: {
  codeId: string;
  isActive: boolean;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    // 检查管理员权限
    if (session.user.role !== Role.ADMIN) {
      return { success: false, error: "权限不足" };
    }

    await db
      .update(redeemCodes)
      .set({
        isActive: params.isActive,
        updatedAt: new Date(),
      })
      .where(eq(redeemCodes.id, params.codeId));

    return { success: true };
  } catch (error) {
    console.error("更新兑换码状态失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新兑换码状态失败",
    };
  }
}

/**
 * 获取兑换码使用记录
 * 仅管理员可用
 */
export async function getRedeemCodeRecords(codeId: string): Promise<{
  success: boolean;
  records?: Array<{
    id: string;
    userId: string;
    credits: number;
    redeemedAt: Date;
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

    // 检查管理员权限
    if (session.user.role !== Role.ADMIN) {
      return { success: false, error: "权限不足" };
    }

    const records = await db
      .select()
      .from(redeemRecords)
      .where(eq(redeemRecords.codeId, codeId))
      .orderBy(desc(redeemRecords.redeemedAt));

    return {
      success: true,
      records: records.map((record) => ({
        id: record.id,
        userId: record.userId,
        credits: record.credits,
        redeemedAt: record.redeemedAt,
      })),
    };
  } catch (error) {
    console.error("获取兑换记录失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取兑换记录失败",
    };
  }
}

/**
 * 生成随机兑换码
 */
function generateRandomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 排除易混淆字符
  let code = "";
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) {
      code += "-";
    }
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code; // 格式：XXXX-XXXX-XXXX
}

