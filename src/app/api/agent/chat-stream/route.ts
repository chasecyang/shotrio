import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { AgentChatInput } from "@/types/agent";
import { collectContext } from "@/lib/actions/agent/context-collector";
import { getChatCompletionWithFunctionsStream } from "@/lib/services/openai.service";
import { AGENT_FUNCTIONS, toOpenAIFunctionFormat, getFunctionDefinition } from "@/lib/actions/agent/functions";
import { executeFunction } from "@/lib/actions/agent/executor";
import type { FunctionCall } from "@/types/agent";

// Next.js 路由配置：禁用缓冲以支持真正的流式输出
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 构建 Agent 系统提示词
 */
function buildAgentSystemPrompt(): string {
  return `你是一个专业的影视创作 AI 助手。你可以通过多轮调用工具来完成复杂任务。

# 你的能力

你可以通过调用工具（functions）来完成各种任务：
- 查询项目信息（剧本内容、分镜列表、素材库等）
- 生成内容（提取剧本元素、生成分镜、拆解分镜、生成图片/视频等）
- 修改内容（更新分镜参数、重新排序等）
- 删除内容（删除分镜、删除素材等）

# 工作模式

你可以进行**多轮自主执行**：
1. **分析任务**：理解用户意图，拆解为多个步骤
2. **收集信息**：先调用查询类工具获取必要信息
3. **规划操作**：基于查询结果，决定下一步操作
4. **执行操作**：调用生成/修改/删除类工具
5. **验证结果**：可以再次查询确认操作是否成功

# 重要原则

- **主动查询**：不确定时先查询，不要猜测
- **逐步执行**：复杂任务分多步完成，每次可以调用一个或多个工具
- **清晰沟通**：
  - **在调用工具前，必须先用简短的自然语言告诉用户你要做什么，这个语言要用户可理解的**
  - 不要只在思考过程中计划，要在回复内容中明确说明行动
  - 例如："好的，我先查询一下素材库..."、"正在为分镜生成图片..."
  - 即使你很确定要调用什么工具，也要先告知用户
- **上下文感知**：充分利用上下文中的信息

# 注意事项

- JSON 参数中的数组需要以 JSON 字符串格式传递（如 '["id1","id2"]'）
- 时长参数以毫秒为单位（3秒 = 3000）
- 优先使用上下文中的信息（如当前选中的剧集 ID、分镜 ID 等）

现在开始工作吧！`;
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

          const functions = toOpenAIFunctionFormat(AGENT_FUNCTIONS);
          const maxIterations = 5;

          // 5. Agent Loop
          for (let iteration = 0; iteration < maxIterations; iteration++) {
            const iterationNumber = iteration + 1;
            
            // 发送迭代开始事件
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: "iteration_start",
                  data: { iterationNumber },
                }) + "\n"
              )
            );

            // 使用流式调用 AI
            let accumulatedReasoning = '';
            let accumulatedContent = '';
            let functionCallId = '';
            let functionCallName = '';
            let functionCallArguments = '';
            let hasFunctionCall = false;

            try {
              for await (const chunk of getChatCompletionWithFunctionsStream(
                currentMessages,
                functions,
                {
                  temperature: 0.7,
                  maxTokens: 32000,
                  useReasoning: true,
                }
              )) {
                switch (chunk.type) {
                  case 'reasoning':
                    // 累积思考过程并实时推送
                    accumulatedReasoning += chunk.data;
                    controller.enqueue(
                      encoder.encode(
                        JSON.stringify({
                          type: "thinking",
                          data: {
                            iterationNumber,
                            content: accumulatedReasoning,
                          },
                        }) + "\n"
                      )
                    );
                    break;

                  case 'content':
                    // 累积回复内容并实时推送
                    accumulatedContent += chunk.data;
                    controller.enqueue(
                      encoder.encode(
                        JSON.stringify({
                          type: "content",
                          data: {
                            iterationNumber,
                            content: accumulatedContent,
                          },
                        }) + "\n"
                      )
                    );
                    break;

                  case 'function_call_id':
                    functionCallId = chunk.data;
                    hasFunctionCall = true;
                    break;

                  case 'function_call_name':
                    functionCallName = chunk.data;
                    hasFunctionCall = true;
                    break;

                  case 'function_call_arguments':
                    functionCallArguments += chunk.data;
                    break;

                  case 'done':
                    // 流结束
                    break;
                }
              }
            } catch (streamError) {
              console.error("[Stream] AI 调用失败:", streamError);
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "error",
                    data: streamError instanceof Error ? streamError.message : "AI 调用失败",
                  }) + "\n"
                )
              );
              break;
            }

            // 将 AI 回复加入对话历史（包含 reasoning_content 和 tool_calls）
            const assistantMessage: {
              role: "assistant";
              content: string;
              reasoning_content?: string;
              tool_calls?: Array<{
                id: string;
                type: "function";
                function: {
                  name: string;
                  arguments: string;
                };
              }>;
            } = {
              role: "assistant",
              content: accumulatedContent || "",
              reasoning_content: accumulatedReasoning || undefined,
            };

            // 如果有工具调用，添加 tool_calls
            if (hasFunctionCall && functionCallId && functionCallName) {
              assistantMessage.tool_calls = [{
                id: functionCallId,
                type: "function",
                function: {
                  name: functionCallName,
                  arguments: functionCallArguments,
                },
              }];
            }

            currentMessages.push(assistantMessage);

            // 如果没有 function call，任务完成
            if (!hasFunctionCall) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "complete",
                    data: "done",
                  }) + "\n"
                )
              );
              break;
            }

            // 解析 function call
            const funcDef = getFunctionDefinition(functionCallName);
            if (!funcDef) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "error",
                    data: `未知的工具: ${functionCallName}`,
                  }) + "\n"
                )
              );
              break;
            }

            let parameters: Record<string, unknown>;
            try {
              parameters = JSON.parse(functionCallArguments);
            } catch {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "error",
                    data: "解析工具参数失败",
                  }) + "\n"
                )
              );
              break;
            }

            const functionCall: FunctionCall = {
              id: `fc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: functionCallName,
              displayName: funcDef.displayName,
              parameters,
              category: funcDef.category,
              needsConfirmation: funcDef.needsConfirmation,
            };

            // 如果需要确认，发送待确认操作并结束
            if (functionCall.needsConfirmation) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "pending_action",
                    data: {
                      id: `action-${Date.now()}`,
                      functionCall,
                      message: accumulatedContent || `准备执行: ${functionCall.name}`,
                    },
                  }) + "\n"
                )
              );
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "complete",
                    data: "pending_confirmation",
                  }) + "\n"
                )
              );
              break;
            }

            // 发送执行状态
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: "function_start",
                  data: {
                    iterationNumber,
                    name: functionCall.name,
                    description: funcDef.description,
                    displayName: funcDef.displayName,
                    category: functionCall.category,
                  },
                }) + "\n"
              )
            );

            // 执行只读操作
            const execResult = await executeFunction(functionCall);

            // 发送执行结果
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: "function_result",
                  data: {
                    iterationNumber,
                    functionCallId: execResult.functionCallId,
                    success: execResult.success,
                    error: execResult.error,
                    jobId: execResult.jobId,
                  },
                }) + "\n"
              )
            );

            // 将执行结果反馈给 AI（使用 tool 角色，符合新的 OpenAI API 格式）
            currentMessages.push({
              role: "tool",
              tool_call_id: functionCallId,
              content: JSON.stringify({
                success: execResult.success,
                data: execResult.data,
                error: execResult.error,
              }),
            });

            // 如果执行失败，停止循环
            if (!execResult.success) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "complete",
                    data: "error",
                  }) + "\n"
                )
              );
              break;
            }
          }

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

