import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { collectContext } from "@/lib/actions/agent/context-collector";
import { runAgentLoop } from "@/lib/services/agent-loop";
import { getConversation, saveMessage, updateConversationStatus, updateConversationTitle } from "@/lib/actions/conversation/crud";
import { generateConversationTitle } from "@/lib/actions/conversation/title-generator";
import type { AgentContext } from "@/types/agent";

// Next.js 路由配置：禁用缓冲以支持真正的流式输出
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 构建 Agent 系统提示词
 */
function buildAgentSystemPrompt(): string {
  return `你是一个专业的微短剧创作 AI 助手。你可以通过多轮调用工具来完成复杂任务。

# 工作模式

你可以进行**多轮自主执行**：
1. **分析任务**：理解用户意图，拆解为多个步骤
2. **收集信息**：先调用查询类工具获取必要信息
3. **规划操作**：基于查询结果，决定下一步操作
4. **执行操作**：调用生成/修改/删除类工具
5. **验证结果**：可以再次查询确认操作是否成功

# 美术风格管理

项目的美术风格会影响所有图像生成的整体风格和氛围。
如果项目已有美术风格，优先遵循该风格，除非用户明确要求更换，如果没有，为了保持一致性，要设置美术风格。

# 图像生成
我们使用的图像生成模型（Nano Banana）支持自然语言描述，可以描述场景、人物、动作、光线、氛围等，用流畅的句子连接

# 角色一致性秘诀：角色三视图

**角色三视图（Character Turnaround/Reference Sheet）是保持短片中角色一致性的关键！**
## 工作流程
1. **先生成角色三视图**：当需要为某个角色生成素材时，优先为该角色生成一张"角色三视图"
2. **用三视图作为参考**：后续生成该角色的其他动作、表情或场景图时，使用三视图作为参考
3. **保持一致性**：这样可以确保同一角色在不同镜头中保持外观、服装、体型等特征的一致性

## 生成分镜图的最佳实践
可以使用多张参考图
- **角色三视图**：提供角色外观一致性
- **场景图**：提供环境风格和氛围
- **其他参考图**：提供动作姿势、光影效果等额外参考

例如：要生成"张三在咖啡厅喝咖啡"的分镜图，可以同时引用：
- 张三的角色三视图素材
- 咖啡厅场景素材
- 可选：喝咖啡姿势的参考图
`;
}

/**
 * POST /api/agent/chat-stream
 * 流式 Agent 聊天接口（支持数据库持久化）
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
      message: string;
      context: AgentContext;
    } = await request.json();

    const encoder = new TextEncoder();

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        let userMessageId: string | undefined;
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

          // 2. 收集上下文信息
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "status", data: "collecting_context" }) + "\n"
            )
          );

          const contextText = await collectContext(input.context);

          // 3. 保存用户消息到数据库
          const userMessageContent = `# 当前上下文\n\n${contextText}\n\n# 用户请求\n\n${input.message}`;
          const userMsgResult = await saveMessage(input.conversationId, {
            role: "user",
            content: input.message, // 只保存用户原始消息，不包含上下文
          });

          if (!userMsgResult.success) {
            throw new Error("保存用户消息失败");
          }
          userMessageId = userMsgResult.messageId;

          // 发送用户消息ID给前端
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "user_message_id", data: userMessageId }) + "\n"
            )
          );

          // 3.5. 如果是第一条消息，生成对话标题
          const isFirstMessage = convResult.messages.length === 0;
          if (isFirstMessage) {
            // 异步生成标题，不阻塞主流程
            generateConversationTitle(input.message).then(async (title) => {
              try {
                // 更新数据库中的对话标题
                await updateConversationTitle(input.conversationId, title);
                
                // 通知前端标题已更新
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "title_updated",
                      data: {
                        conversationId: input.conversationId,
                        title,
                      },
                    }) + "\n"
                  )
                );
              } catch (error) {
                console.error("[ChatStream] 更新对话标题失败:", error);
              }
            }).catch((error) => {
              console.error("[ChatStream] 生成对话标题失败:", error);
            });
          }

          // 4. 构建对话历史（用于AI）
          const currentMessages: Array<{
            role: "system" | "user" | "assistant" | "tool";
            content: string;
            reasoning_content?: string;
            tool_call_id?: string;
            tool_calls?: Array<{
              id: string;
              type: "function";
              function: {
                name: string;
                arguments: string;
              };
            }>;
          }> = [
            { role: "system", content: buildAgentSystemPrompt() },
          ];

          // 添加历史消息（简化版，只包含 role 和 content）
          for (const msg of convResult.messages) {
            if (msg.role !== "system") {
              currentMessages.push({
                role: msg.role as "user" | "assistant",
                content: msg.content,
              });
            }
          }

          // 添加当前用户消息（带上下文）
          currentMessages.push({
            role: "user",
            content: userMessageContent,
          });

          // 5. 创建 assistant 消息占位
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

          // 7. 运行 Agent Loop（传递 conversationId 和 assistantMessageId）
          await runAgentLoop(
            currentMessages,
            controller,
            encoder,
            5,
            input.conversationId,
            assistantMessageId
          );

          // 8. 流完成，更新对话状态为 completed
          await updateConversationStatus(input.conversationId, "completed");

          controller.close();
        } catch (error) {
          console.error("[Stream] 错误:", error);
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
    console.error("[Stream API] 错误:", error);
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

