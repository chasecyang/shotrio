import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { AgentChatInput } from "@/types/agent";
import { collectContext } from "@/lib/actions/agent/context-collector";
import { runAgentLoop } from "@/lib/services/agent-loop";

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
 * 格式化历史消息
 */
function formatHistory(history: Array<{ role: string; content: string }>): Array<{ role: string; content: string }> {
  return history.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * POST /api/agent/chat-stream
 * 流式 Agent 聊天接口
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
    const input: AgentChatInput = await request.json();
    const encoder = new TextEncoder();

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 1. 发送状态：正在收集上下文
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "status", data: "collecting_context" }) + "\n"
            )
          );

          // 2. 收集上下文信息
          const contextText = await collectContext(input.context);

          // 3. 构建用户消息
          const userMessageWithContext = `# 当前上下文\n\n${contextText}\n\n# 用户请求\n\n${input.message}`;

          // 4. 构建对话历史
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
            ...formatHistory(input.history).map((m) => ({
              role: m.role as "system" | "user" | "assistant",
              content: m.content,
            })),
            { role: "user", content: userMessageWithContext },
          ];

          // 5. 运行 Agent Loop
          await runAgentLoop(currentMessages, controller, encoder);

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

