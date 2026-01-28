/**
 * Agent Stream API
 *
 * 统一的 Agent 流式 API，使用新的 AgentEngine
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { AgentEngine } from "@/lib/services/agent-engine";
import type { AgentContext } from "@/types/agent";
import { getTranslations } from "next-intl/server";

// Next.js 路由配置
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/stream
 *
 * 统一的 Agent 流式 API
 * - 支持新对话
 * - 支持恢复对话（用户确认/拒绝后继续）
 */
export async function POST(request: NextRequest) {
  const t = await getTranslations("errors");
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: t("notLoggedIn") }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const input: {
      // 新对话参数
      message?: string;
      context?: AgentContext;
      conversationId?: string;

      // 恢复对话参数
      resumeConversationId?: string;
      resumeValue?: {
        approved: boolean;
        modifiedParams?: Record<string, unknown>; // 用户修改的参数（单个模式）
        feedback?: string; // 拒绝时的反馈
        batchModifiedParams?: Record<string, Record<string, unknown>>; // 批量修改参数
        disabledIds?: string[]; // 被禁用的 tool call IDs
      };
    } = await request.json();

    const encoder = new TextEncoder();

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const engine = new AgentEngine();

          // 场景1: 新对话
          if (input.message && input.context && input.conversationId) {
            console.log("[Agent Stream] 开始新对话:", input.conversationId);

            for await (const event of engine.streamConversation(
              input.conversationId,
              input.message,
              input.context
            )) {
              controller.enqueue(
                encoder.encode(JSON.stringify(event) + "\n")
              );
            }
          }
          // 场景2: 恢复对话（用户确认/拒绝）
          else if (input.resumeConversationId && input.resumeValue !== undefined) {
            console.log(
              "[Agent Stream] 恢复对话:",
              input.resumeConversationId,
              input.resumeValue.approved ? "（用户同意）" : "（用户拒绝）",
              input.resumeValue.modifiedParams ? "使用修改后的参数" : "",
              input.resumeValue.batchModifiedParams ? "使用批量修改参数" : "",
              input.resumeValue.disabledIds?.length ? `禁用 ${input.resumeValue.disabledIds.length} 个操作` : ""
            );

            for await (const event of engine.resumeConversation(
              input.resumeConversationId,
              input.resumeValue.approved,
              input.resumeValue.modifiedParams,
              input.resumeValue.feedback,
              input.resumeValue.batchModifiedParams,
              input.resumeValue.disabledIds ? new Set(input.resumeValue.disabledIds) : undefined
            )) {
              controller.enqueue(
                encoder.encode(JSON.stringify(event) + "\n")
              );
            }
          } else {
            throw new Error(t("agent.invalidRequestParams"));
          }

          controller.close();
        } catch (error) {
          console.error("[Agent Stream] 错误:", error);

          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                data: error instanceof Error ? error.message : t("agent.processingFailed"),
              }) + "\n"
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Agent Stream API] 错误:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : t("agent.processingFailed"),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
