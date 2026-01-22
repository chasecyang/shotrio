import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { handleCreemWebhook } from "@/lib/actions/payment/webhook";
import { creemConfig } from "@/lib/payment/creem.config";

/**
 * Creem Webhook处理器
 * 
 * 在Creem后台配置webhook URL：
 * https://your-domain.com/api/webhooks/creem
 */
export async function POST(request: NextRequest) {
  try {
    // 获取签名（如果有）
    const signature = request.headers.get("creem-signature") || undefined;
    const rawBody = await request.text();

    if (creemConfig.webhookSecret) {
      if (!signature) {
        return NextResponse.json(
          { error: "Missing webhook signature" },
          { status: 400 }
        );
      }

      const isValid = verifySignature(rawBody, signature, creemConfig.webhookSecret);
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 400 }
        );
      }
    }

    // 获取请求体
    const body = JSON.parse(rawBody);

    const eventType = body.eventType || body.event || body.type;
    const payload = body.object ?? body.data ?? body;
    const metadata = payload?.metadata ?? {};

    const webhookData =
      eventType === "checkout.completed"
        ? {
            orderId: metadata.orderId || metadata.order_id,
            sessionId: payload?.id,
            paymentId: payload?.order?.id,
            status: payload?.status,
            amount: payload?.order?.amount,
          }
        : payload;

    // 处理webhook
    const result = await handleCreemWebhook({
      event: eventType,
      data: webhookData,
      signature,
    });

    if (!result.success) {
      console.error("Webhook处理失败:", result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook处理异常:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

function verifySignature(payload: string, signature: string, secret: string) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const signatureBuf = Buffer.from(signature, "utf8");

  if (expectedBuf.length !== signatureBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

// 禁用body解析，让我们手动处理
export const runtime = "nodejs";
