import { NextRequest, NextResponse } from "next/server";
import { getStripe, stripeConfig } from "@/lib/payment/stripe.config";
import { handleStripeWebhook } from "@/lib/actions/payment/webhook";

/**
 * Stripe Webhook处理器
 *
 * 在Stripe Dashboard配置webhook URL：
 * https://your-domain.com/api/webhooks/stripe
 *
 * 需要监听的事件：
 * - checkout.session.completed
 * - payment_intent.succeeded
 * - payment_intent.payment_failed
 * - charge.refunded
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    let event;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        stripeConfig.webhookSecret
      );
    } catch (err) {
      console.error("Webhook签名验证失败:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    const result = await handleStripeWebhook(event);

    if (!result.success) {
      console.error("Webhook处理失败:", result.error);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook处理异常:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
