import { NextRequest, NextResponse } from "next/server";
import { handleCreemWebhook } from "@/lib/actions/payment/webhook";

/**
 * Creem Webhook处理器
 * 
 * 在Creem后台配置webhook URL：
 * https://your-domain.com/api/webhooks/creem
 */
export async function POST(request: NextRequest) {
  try {
    // 获取请求体
    const body = await request.json();
    
    // 获取签名（如果有）
    const signature = request.headers.get("creem-signature") || undefined;

    // 处理webhook
    const result = await handleCreemWebhook({
      event: body.event || body.type,
      data: body.data || body,
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

// 禁用body解析，让我们手动处理
export const runtime = "nodejs";

