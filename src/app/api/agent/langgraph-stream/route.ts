import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getAgentGraph } from "@/lib/services/langgraph/graph";
import { generateThreadId } from "@/lib/services/langgraph/checkpointer";
import { HumanMessage } from "@langchain/core/messages";
import type { AgentContext } from "@/types/agent";
import { saveMessage, updateMessage, updateConversationStatus, updateConversationThreadId } from "@/lib/actions/conversation/crud";

// Next.js 路由配置
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/langgraph-stream
 * 
 * 统一的 LangGraph 流式 API
 * - 支持新对话
 * - 支持恢复对话（用户确认/拒绝后继续）
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
      // 新对话参数
      message?: string;
      context?: AgentContext;
      conversationId?: string;
      
      // 恢复对话参数
      threadId?: string;
      resumeValue?: {
        approved: boolean;
        reason?: string;
      };
    } = await request.json();

    const encoder = new TextEncoder();

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        let userMessageId: string | undefined;
        let assistantMessageId: string | undefined;
        let conversationId = input.conversationId;
        let threadId = input.threadId;

        try {
          // 获取 Agent 图
          const graph = await getAgentGraph();

          // 场景1: 新对话
          if (input.message && input.context && conversationId) {
            console.log("[LangGraph Stream] 开始新对话");
            
            // 生成 thread ID
            threadId = generateThreadId(input.context.projectId, conversationId);
            
            // 保存 threadId 到数据库
            await updateConversationThreadId(conversationId, threadId);

            // 保存用户消息
            const userMsgResult = await saveMessage(conversationId, {
              role: "user",
              content: input.message,
            });

            if (!userMsgResult.success) {
              throw new Error("保存用户消息失败");
            }
            userMessageId = userMsgResult.messageId;

            // 发送用户消息ID
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: "user_message_id", data: userMessageId }) + "\n"
              )
            );

            // 创建 assistant 消息占位
            const assistantMsgResult = await saveMessage(conversationId, {
              role: "assistant",
              content: "",
            });

            if (!assistantMsgResult.success) {
              throw new Error("创建 assistant 消息失败");
            }
            assistantMessageId = assistantMsgResult.messageId;

            // 发送 assistant 消息ID
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: "assistant_message_id", data: assistantMessageId }) + "\n"
              )
            );

            // 更新对话状态
            await updateConversationStatus(conversationId, "active");

            // 运行图
            const config = {
              configurable: {
                thread_id: threadId,
                checkpoint_ns: input.context.projectId,
              },
            };

            const initialState = {
              messages: [new HumanMessage(input.message)],
              projectContext: input.context,
              conversationId,
              projectId: input.context.projectId,
            };

            // 流式执行
            for await (const event of await graph.stream(initialState, {
              ...config,
              streamMode: "values",
            })) {
              // 发送状态更新
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "state_update",
                    data: {
                      iterations: event.iterations || [],
                      currentIteration: event.currentIteration || 0,
                      pendingAction: event.pendingAction,
                    },
                  }) + "\n"
                )
              );

              // 如果有 pendingAction，说明需要用户确认
              if (event.pendingAction) {
                console.log("[LangGraph Stream] 需要用户确认");
                
                // 更新消息状态（不再保存 pendingAction 到数据库）
                if (assistantMessageId) {
                  await updateMessage(assistantMessageId, {
                    iterations: JSON.stringify(event.iterations || []),
                  });
                }

                // 更新对话状态
                await updateConversationStatus(conversationId, "awaiting_approval");

                // 发送中断事件
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "interrupt",
                      data: {
                        action: "approval_required",
                        pendingAction: event.pendingAction,
                        threadId,
                      },
                    }) + "\n"
                  )
                );

                // 结束流
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({ type: "complete", data: "pending_confirmation" }) + "\n"
                  )
                );
                controller.close();
                return;
              }
            }

            // 正常完成
            if (assistantMessageId) {
              const finalState = await graph.getState(config);
              const lastMessage = finalState.values.messages[finalState.values.messages.length - 1];
              
              await updateMessage(assistantMessageId, {
                content: typeof lastMessage.content === "string" 
                  ? lastMessage.content 
                  : JSON.stringify(lastMessage.content),
                iterations: JSON.stringify(finalState.values.iterations || []),
              });
            }

            await updateConversationStatus(conversationId, "completed");

            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: "complete", data: "done" }) + "\n"
              )
            );
          }
          // 场景2: 恢复对话（用户确认/拒绝）
          else if (input.threadId && input.resumeValue !== undefined) {
            console.log("[LangGraph Stream] 恢复对话", input.resumeValue.approved ? "（用户同意）" : "（用户拒绝）");

            if (!threadId) {
              throw new Error("缺少 threadId");
            }

            // 从 threadId 解析 conversationId
            const parts = threadId.split("_");
            if (parts.length !== 2) {
              throw new Error("无效的 threadId");
            }
            conversationId = parts[1];

            // 创建新的 assistant 消息
            const assistantMsgResult = await saveMessage(conversationId, {
              role: "assistant",
              content: "",
            });

            if (!assistantMsgResult.success) {
              throw new Error("创建 assistant 消息失败");
            }
            assistantMessageId = assistantMsgResult.messageId;

            // 发送 assistant 消息ID
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: "assistant_message_id", data: assistantMessageId }) + "\n"
              )
            );

            // 更新对话状态
            await updateConversationStatus(conversationId, "active");

            // 获取图
            const graph = await getAgentGraph();
            const config = {
              configurable: {
                thread_id: threadId,
              },
            };

            // 设置用户审批决定到状态中
            const resumeInput = {
              userApproval: {
                approved: input.resumeValue.approved,
                reason: input.resumeValue.reason,
              },
            };

            // 继续执行图
            for await (const event of await graph.stream(resumeInput, {
              ...config,
              streamMode: "values",
            })) {
              // 发送状态更新
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "state_update",
                    data: {
                      iterations: event.iterations || [],
                      currentIteration: event.currentIteration || 0,
                      pendingAction: event.pendingAction,
                    },
                  }) + "\n"
                )
              );

              // 如果又有 pendingAction，说明需要再次确认
              if (event.pendingAction) {
                console.log("[LangGraph Stream] 需要再次确认");
                
                if (assistantMessageId) {
                  await updateMessage(assistantMessageId, {
                    iterations: JSON.stringify(event.iterations || []),
                  });
                }

                await updateConversationStatus(conversationId, "awaiting_approval");

                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "interrupt",
                      data: {
                        action: "approval_required",
                        pendingAction: event.pendingAction,
                        threadId,
                      },
                    }) + "\n"
                  )
                );

                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({ type: "complete", data: "pending_confirmation" }) + "\n"
                  )
                );
                controller.close();
                return;
              }
            }

            // 正常完成
            if (assistantMessageId) {
              const finalState = await graph.getState(config);
              const lastMessage = finalState.values.messages[finalState.values.messages.length - 1];
              
              await updateMessage(assistantMessageId, {
                content: typeof lastMessage.content === "string" 
                  ? lastMessage.content 
                  : JSON.stringify(lastMessage.content),
                iterations: JSON.stringify(finalState.values.iterations || []),
              });
            }

            await updateConversationStatus(conversationId, "completed");

            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: "complete", data: "done" }) + "\n"
              )
            );
          } else {
            throw new Error("无效的请求参数");
          }

          controller.close();
        } catch (error) {
          console.error("[LangGraph Stream] 错误:", error);

          // 更新对话状态
          if (conversationId) {
            await updateConversationStatus(conversationId, "completed");
          }

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
    console.error("[LangGraph Stream API] 错误:", error);
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

