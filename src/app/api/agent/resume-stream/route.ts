import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { runAgentLoop } from "@/lib/services/agent-loop";
import { getConversation, updateConversationStatus, saveMessage } from "@/lib/actions/conversation/crud";

// Next.js 路由配置：禁用缓冲以支持真正的流式输出
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/resume-stream
 * 恢复对话并继续 Agent 执行（从数据库）
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
    const input: {
      conversationId: string;
      messageId: string; // 包含 pendingAction 的消息ID
      executionResults: Array<{
        functionCallId: string;
        success: boolean;
        data?: unknown;
        error?: string;
        jobId?: string;
      }>;
    } = await request.json();

    const encoder = new TextEncoder();

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        let assistantMessageId: string | undefined;

        try {
          // 1. 从数据库加载对话历史
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "status", data: "loading_history" }) + "\n"
            )
          );

          const convResult = await getConversation(input.conversationId);
          if (!convResult.success || !convResult.messages) {
            throw new Error(convResult.error || "无法加载对话历史");
          }

          // 2. 找到包含 pendingAction 的消息
          const messageWithAction = convResult.messages.find(
            (msg) => msg.id === input.messageId && msg.pendingAction
          );

          if (!messageWithAction || !messageWithAction.pendingAction) {
            throw new Error("无法找到待确认的操作");
          }

          const conversationState = messageWithAction.pendingAction.conversationState;
          if (!conversationState) {
            throw new Error("对话状态不完整");
          }

          // 3. 恢复对话历史
          const currentMessages = [...conversationState.messages];

          // 4. 添加工具执行结果
          for (const result of input.executionResults) {
            currentMessages.push({
              role: "tool",
              tool_call_id: conversationState.toolCallId,
              content: JSON.stringify({
                success: result.success,
                data: result.data,
                error: result.error,
              }),
            });
          }

          // 5. 创建新的 assistant 消息
          const assistantMsgResult = await saveMessage(input.conversationId, {
            role: "assistant",
            content: "",
            isStreaming: true,
          });

          if (!assistantMsgResult.success) {
            throw new Error("创建 assistant 消息失败");
          }
          assistantMessageId = assistantMsgResult.messageId;

          // 发送 assistant 消息ID给前端
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "assistant_message_id", data: assistantMessageId }) + "\n"
            )
          );

          // 6. 更新对话状态为 active
          await updateConversationStatus(input.conversationId, "active");

          // 7. 继续 Agent Loop
          await runAgentLoop(
            currentMessages,
            controller,
            encoder,
            input.conversationId,
            assistantMessageId
          );

          // 8. 流完成，更新对话状态为 completed
          await updateConversationStatus(input.conversationId, "completed");

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

