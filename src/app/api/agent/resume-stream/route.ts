import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { ResumeConversationInput } from "@/types/agent";
import { runAgentLoop } from "@/lib/services/agent-loop";

// Next.js 路由配置：禁用缓冲以支持真正的流式输出
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/resume-stream
 * 恢复对话并继续 Agent 执行
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const input: ResumeConversationInput = await request.json();
    const encoder = new TextEncoder();

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 1. 恢复对话历史
          const currentMessages = [...input.conversationState.messages];

          // 2. 添加工具执行结果
          for (const result of input.executionResults) {
            currentMessages.push({
              role: "tool",
              tool_call_id: input.conversationState.toolCallId,
              content: JSON.stringify({
                success: result.success,
                data: result.data,
                error: result.error,
              }),
            });
          }

          // 3. 继续 Agent Loop
          await runAgentLoop(currentMessages, controller, encoder);

          controller.close();
        } catch (error) {
          console.error("[Resume Stream] 错误:", error);
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                data: error instanceof Error ? error.message : "处理失败",
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
    console.error("[Resume Stream API] 错误:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "处理失败",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

