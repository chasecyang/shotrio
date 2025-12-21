"use server";

import db from "@/lib/db";
import { orders, OrderStatus, TransactionType } from "@/lib/db/schemas/payment";
import { eq } from "drizzle-orm";
import { addCredits } from "@/lib/actions/credits/spend";
import { creemConfig } from "@/lib/payment/creem.config";
import { CREDIT_PACKAGES } from "@/types/payment";

/**
 * 处理Creem webhook事件
 * 
 * 这个函数应该在 app/api/webhooks/creem/route.ts 中调用
 */
export async function handleCreemWebhook(params: {
  event: string;
  data: {
    orderId?: string;
    sessionId?: string;
    paymentId?: string;
    amount?: number;
    status?: string;
  };
  signature?: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { event, data, signature } = params;

    // 验证webhook签名（如果配置了密钥）
    if (creemConfig.webhookSecret && signature) {
      // TODO: 实现实际的签名验证逻辑
      // 这取决于Creem的具体实现
      // const isValid = verifySignature(signature, data, creemConfig.webhookSecret);
      // if (!isValid) {
      //   return { success: false, error: "无效的webhook签名" };
      // }
    }

    // 处理支付成功事件
    if (event === "payment.succeeded" || event === "checkout.completed") {
      return await handlePaymentSuccess(data);
    }

    // 处理支付失败事件
    if (event === "payment.failed") {
      return await handlePaymentFailure(data);
    }

    // 处理退款事件
    if (event === "payment.refunded") {
      return await handlePaymentRefund(data);
    }

    // 其他事件暂时忽略
    return { success: true };
  } catch (error) {
    console.error("处理webhook失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "处理webhook失败",
    };
  }
}

/**
 * 处理支付成功
 */
async function handlePaymentSuccess(data: {
  orderId?: string;
  sessionId?: string;
  paymentId?: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  const { orderId, sessionId, paymentId } = data;

  if (!orderId && !sessionId) {
    return { success: false, error: "缺少订单ID或会话ID" };
  }

  // 查找订单
  const [order] = await db
    .select()
    .from(orders)
    .where(
      orderId
        ? eq(orders.id, orderId)
        : eq(orders.creemSessionId, sessionId!)
    )
    .limit(1);

  if (!order) {
    return { success: false, error: "订单不存在" };
  }

  // 检查订单是否已经处理过
  if (order.status === OrderStatus.COMPLETED) {
    return { success: true }; // 已处理，直接返回成功
  }

  // 使用事务确保原子性
  await db.transaction(async (tx) => {
    // 1. 更新订单状态
    await tx
      .update(orders)
      .set({
        status: OrderStatus.COMPLETED,
        creemPaymentId: paymentId || null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    // 2. 增加基础积分
    await addCredits({
      userId: order.userId,
      amount: order.credits,
      type: TransactionType.PURCHASE,
      description: `购买积分包 - ${order.packageType}`,
      orderId: order.id,
      metadata: {
        packageType: order.packageType,
        amount: order.amount,
      },
    });

    // 3. 如果有赠送积分，单独添加
    if (order.bonusCredits > 0) {
      // 从配置中获取对应套餐的赠送比例
      const pkg = CREDIT_PACKAGES.find(p => p.type === order.packageType);
      const bonusPercent = pkg?.bonusPercent || 0;

      await addCredits({
        userId: order.userId,
        amount: order.bonusCredits,
        type: TransactionType.BONUS,
        description: "购买赠送",
        orderId: order.id,
        metadata: {
          bonusPercent,
        },
      });
    }
  });

  return { success: true };
}

/**
 * 处理支付失败
 */
async function handlePaymentFailure(data: {
  orderId?: string;
  sessionId?: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  const { orderId, sessionId } = data;

  if (!orderId && !sessionId) {
    return { success: false, error: "缺少订单ID或会话ID" };
  }

  // 查找订单
  const [order] = await db
    .select()
    .from(orders)
    .where(
      orderId
        ? eq(orders.id, orderId)
        : eq(orders.creemSessionId, sessionId!)
    )
    .limit(1);

  if (!order) {
    return { success: false, error: "订单不存在" };
  }

  // 更新订单状态为失败
  await db
    .update(orders)
    .set({
      status: OrderStatus.FAILED,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  return { success: true };
}

/**
 * 处理退款
 */
async function handlePaymentRefund(data: {
  orderId?: string;
  paymentId?: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  const { orderId, paymentId } = data;

  if (!orderId && !paymentId) {
    return { success: false, error: "缺少订单ID或支付ID" };
  }

  // 查找订单
  const [order] = await db
    .select()
    .from(orders)
    .where(
      orderId
        ? eq(orders.id, orderId)
        : eq(orders.creemPaymentId, paymentId!)
    )
    .limit(1);

  if (!order) {
    return { success: false, error: "订单不存在" };
  }

  // 更新订单状态为已退款
  await db
    .update(orders)
    .set({
      status: OrderStatus.REFUNDED,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  // TODO: 可以考虑扣除用户相应的积分
  // 但需要注意用户当前余额是否充足

  return { success: true };
}

