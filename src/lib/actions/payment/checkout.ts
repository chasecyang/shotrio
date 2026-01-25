"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { orders, OrderStatus } from "@/lib/db/schemas/payment";
import { eq, and, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  getStripe,
  stripeConfig,
  validateStripeConfig,
} from "@/lib/payment/stripe.config";
import { CREDIT_PACKAGES, type PackageType } from "@/types/payment";

/**
 * 创建Stripe支付会话
 */
export async function createCheckoutSession(params: {
  packageType: PackageType;
}): Promise<{
  success: boolean;
  checkoutUrl?: string;
  orderId?: string;
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
    const { packageType } = params;

    // 获取积分包配置
    const pkg = CREDIT_PACKAGES.find((p) => p.type === packageType);
    if (!pkg) {
      return { success: false, error: "无效的积分包类型" };
    }

    // 计算积分（每次购买都按套餐配置赠送）
    const baseCredits = pkg.credits;
    const bonusCredits = Math.floor(baseCredits * (pkg.bonusPercent / 100));

    // 创建订单
    const orderId = nanoid();

    await db.insert(orders).values({
      id: orderId,
      userId,
      packageType,
      amount: pkg.price.toString(),
      credits: baseCredits,
      bonusCredits,
      isFirstPurchase: false,
      status: OrderStatus.PENDING,
      metadata: JSON.stringify({
        packageName: pkg.name,
        packageDescription: pkg.description,
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    validateStripeConfig();

    // 计算总积分用于显示
    const totalCredits = baseCredits + bonusCredits;

    // 创建 Stripe Checkout Session（使用动态价格，无需预先创建产品）
    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${pkg.name} - ${totalCredits} Credits`,
              description: pkg.bonusPercent > 0
                ? `${baseCredits} credits + ${bonusCredits} bonus (${pkg.bonusPercent}% extra)`
                : `${baseCredits} credits`,
            },
            unit_amount: pkg.price * 100, // Stripe 使用分为单位
          },
          quantity: 1,
        },
      ],
      success_url: stripeConfig.successUrl,
      cancel_url: stripeConfig.cancelUrl,
      customer_email: session.user.email || undefined,
      metadata: {
        orderId,
        userId,
        packageType,
        packageName: pkg.name,
      },
    });

    if (!checkoutSession.url) {
      return { success: false, error: "Stripe checkout URL缺失" };
    }

    await db
      .update(orders)
      .set({
        stripeSessionId: checkoutSession.id,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    return {
      success: true,
      checkoutUrl: checkoutSession.url,
      orderId,
    };
  } catch (error) {
    console.error("创建支付会话失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建支付会话失败",
    };
  }
}

/**
 * 获取用户订单列表
 */
export async function getUserOrders(options?: {
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  orders?: Array<{
    id: string;
    packageType: PackageType;
    amount: string;
    credits: number;
    bonusCredits: number;
    isFirstPurchase: boolean;
    status: OrderStatus;
    createdAt: Date;
    completedAt: Date | null;
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

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, session.user.id))
      .orderBy(orders.createdAt)
      .limit(limit)
      .offset(offset);

    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(orders)
      .where(eq(orders.userId, session.user.id));

    return {
      success: true,
      orders: userOrders.map((order) => ({
        id: order.id,
        packageType: order.packageType,
        amount: order.amount,
        credits: order.credits,
        bonusCredits: order.bonusCredits,
        isFirstPurchase: order.isFirstPurchase,
        status: order.status,
        createdAt: order.createdAt,
        completedAt: order.completedAt,
      })),
      total: Number(totalCount),
    };
  } catch (error) {
    console.error("获取订单列表失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取订单列表失败",
    };
  }
}

/**
 * 根据ID获取订单详情
 */
export async function getOrderById(orderId: string): Promise<{
  success: boolean;
  order?: {
    id: string;
    packageType: PackageType;
    amount: string;
    credits: number;
    bonusCredits: number;
    isFirstPurchase: boolean;
    status: OrderStatus;
    createdAt: Date;
    completedAt: Date | null;
    metadata?: string | null;
  };
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "未登录" };
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(eq(orders.id, orderId), eq(orders.userId, session.user.id))
      )
      .limit(1);

    if (!order) {
      return { success: false, error: "订单不存在" };
    }

    return {
      success: true,
      order: {
        id: order.id,
        packageType: order.packageType,
        amount: order.amount,
        credits: order.credits,
        bonusCredits: order.bonusCredits,
        isFirstPurchase: order.isFirstPurchase,
        status: order.status,
        createdAt: order.createdAt,
        completedAt: order.completedAt,
        metadata: order.metadata,
      },
    };
  } catch (error) {
    console.error("获取订单详情失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取订单详情失败",
    };
  }
}
