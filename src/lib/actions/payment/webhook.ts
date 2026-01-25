"use server";

import db from "@/lib/db";
import { orders, OrderStatus, TransactionType } from "@/lib/db/schemas/payment";
import { eq } from "drizzle-orm";
import { addCredits } from "@/lib/actions/credits/spend";
import { CREDIT_PACKAGES } from "@/types/payment";
import type Stripe from "stripe";

/**
 * 处理Stripe webhook事件
 */
export async function handleStripeWebhook(event: Stripe.Event): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        return await handleCheckoutCompleted(session);
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        return await handlePaymentIntentSucceeded(paymentIntent);
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        return await handlePaymentFailed(paymentIntent);
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        return await handleRefund(charge);
      }
      default:
        return { success: true };
    }
  } catch (error) {
    console.error("处理Stripe webhook失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "处理webhook失败",
    };
  }
}

/**
 * 处理 Checkout Session 完成
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<{ success: boolean; error?: string }> {
  const orderId = session.metadata?.orderId;

  if (!orderId) {
    return { success: false, error: "缺少订单ID" };
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return { success: false, error: "订单不存在" };
  }

  if (order.status === OrderStatus.COMPLETED) {
    return { success: true };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: OrderStatus.COMPLETED,
        stripePaymentIntentId: session.payment_intent as string,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    await addCredits({
      userId: order.userId,
      amount: order.credits,
      type: TransactionType.PURCHASE,
      description: `descriptions.purchase.credit_package`,
      orderId: order.id,
      metadata: {
        packageType: order.packageType,
        amount: order.amount,
        translationParams: { packageType: order.packageType },
      },
    });

    if (order.bonusCredits > 0) {
      const pkg = CREDIT_PACKAGES.find((p) => p.type === order.packageType);
      const bonusPercent = pkg?.bonusPercent || 0;

      await addCredits({
        userId: order.userId,
        amount: order.bonusCredits,
        type: TransactionType.BONUS,
        description: "descriptions.bonus.purchase_bonus",
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
 * 处理 PaymentIntent 成功（备用，主要逻辑在 checkout.session.completed）
 */
async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<{ success: boolean; error?: string }> {
  const orderId = paymentIntent.metadata?.orderId;

  if (!orderId) {
    return { success: true };
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.status === OrderStatus.COMPLETED) {
    return { success: true };
  }

  await db
    .update(orders)
    .set({
      stripePaymentIntentId: paymentIntent.id,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  return { success: true };
}

/**
 * 处理支付失败
 */
async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<{ success: boolean; error?: string }> {
  const orderId = paymentIntent.metadata?.orderId;

  if (!orderId) {
    return { success: true };
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return { success: false, error: "订单不存在" };
  }

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
async function handleRefund(
  charge: Stripe.Charge
): Promise<{ success: boolean; error?: string }> {
  const paymentIntentId = charge.payment_intent as string;

  if (!paymentIntentId) {
    return { success: true };
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.stripePaymentIntentId, paymentIntentId))
    .limit(1);

  if (!order) {
    return { success: false, error: "订单不存在" };
  }

  await db
    .update(orders)
    .set({
      status: OrderStatus.REFUNDED,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  return { success: true };
}
