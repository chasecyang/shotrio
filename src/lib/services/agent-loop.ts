/**
 * Agent Loop 共享逻辑
 * 
 * 提供可复用的 Agent 执行循环，供 chat-stream 和 resume-stream 使用
 */

import { getChatCompletionWithFunctionsStream } from "./openai.service";
import { AGENT_FUNCTIONS, toOpenAIFunctionFormat, getFunctionDefinition } from "../actions/agent/functions";
import { executeFunction } from "../actions/agent/executor";
import { estimateActionCredits } from "../actions/credits/estimate";
import { updateMessage, updateConversationStatus } from "../actions/conversation/crud";
import type { FunctionCall, IterationStep } from "@/types/agent";

type Message = {
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
};

/**
 * 运行 Agent Loop
 * 
 * @param currentMessages - 当前对话历史
 * @param controller - 流式响应控制器
 * @param encoder - 文本编码器
 * @param conversationId - 可选的对话ID（用于数据库持久化）
 * @param assistantMessageId - 可选的助手消息ID（用于实时更新）
 * @returns 完成类型：done（正常完成）、pending_confirmation（等待确认）、error（错误）
 */
export async function runAgentLoop(
  currentMessages: Message[],
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  conversationId?: string,
  assistantMessageId?: string
): Promise<{ completionType: 'done' | 'pending_confirmation' | 'error' }> {
  const functions = toOpenAIFunctionFormat(AGENT_FUNCTIONS);
  const iterations: IterationStep[] = [];

  let iteration = 0;
  while (true) {
    iteration++;
    
    // 发送迭代开始事件
    controller.enqueue(
      encoder.encode(
        JSON.stringify({
          type: "iteration_start",
          data: { iterationNumber: iteration },
        }) + "\n"
      )
    );

    // 🔵 关键节点1：迭代开始时，创建迭代记录
    if (assistantMessageId) {
      await updateMessage(assistantMessageId, {
        iterations: JSON.stringify(iterations),
      });
    }

    // 使用流式调用 AI
    let accumulatedReasoning = '';
    let accumulatedContent = '';
    let functionCallId = '';
    let functionCallName = '';
    let functionCallArguments = '';
    let hasFunctionCall = false;
    
    // 创建当前迭代步骤
    const currentIteration: IterationStep = {
      id: `iter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      iterationNumber: iteration,
      timestamp: new Date(),
    };
    iterations.push(currentIteration);

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
            // 累积思考过程并实时推送给前端
            accumulatedReasoning += chunk.data;
            currentIteration.thinkingProcess = accumulatedReasoning;
            
            // ✅ 继续实时推送给前端
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: "thinking",
                  data: {
                    iterationNumber: iteration,
                    content: accumulatedReasoning,
                  },
                }) + "\n"
              )
            );
            
            // ❌ 删除实时数据库更新 - 改为在关键节点批量更新
            break;

          case 'content':
            // 累积回复内容并实时推送给前端
            accumulatedContent += chunk.data;
            currentIteration.content = accumulatedContent;
            
            // ✅ 继续实时推送给前端
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: "content",
                  data: {
                    iterationNumber: iteration,
                    content: accumulatedContent,
                  },
                }) + "\n"
              )
            );
            
            // ❌ 删除实时数据库更新 - 改为在关键节点批量更新
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
      console.error("[Agent Loop] AI 调用失败:", streamError);
      controller.enqueue(
        encoder.encode(
          JSON.stringify({
            type: "error",
            data: streamError instanceof Error ? streamError.message : "AI 调用失败",
          }) + "\n"
        )
      );
      return { completionType: 'error' };
    }

    // 将 AI 回复加入对话历史（包含 reasoning_content 和 tool_calls）
    const assistantMessage: Message = {
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
      
      // 🔵 关键节点3：Function call前，保存当前状态
      if (assistantMessageId) {
        await updateMessage(assistantMessageId, {
          content: accumulatedContent,
          thinkingProcess: accumulatedReasoning,
          iterations: JSON.stringify(iterations),
        });
      }
    }

    currentMessages.push(assistantMessage);

    // 如果没有 function call，任务完成
    if (!hasFunctionCall) {
      // 🔵 关键节点2：流结束时，保存最终状态（包括thinking和content）
      if (assistantMessageId) {
        await updateMessage(assistantMessageId, {
          content: accumulatedContent || "完成",
          thinkingProcess: accumulatedReasoning || undefined,
          isStreaming: false,
          iterations: JSON.stringify(iterations),
        });
      }
      
      controller.enqueue(
        encoder.encode(
          JSON.stringify({
            type: "complete",
            data: "done",
          }) + "\n"
        )
      );
      return { completionType: 'done' };
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
      return { completionType: 'error' };
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
      return { completionType: 'error' };
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
      // 计算积分消耗
      let creditCost;
      try {
        const estimateResult = await estimateActionCredits([functionCall]);
        if (estimateResult.success && estimateResult.creditCost) {
          creditCost = estimateResult.creditCost;
        }
      } catch (error) {
        console.error("[Agent Loop] 计算积分失败:", error);
        // 即使计算失败也继续，只是不显示积分信息
      }

      const pendingAction = {
        id: `action-${Date.now()}`,
        functionCalls: [functionCall],
        message: accumulatedContent || `准备执行: ${functionCall.name}`,
        conversationState: {
          messages: currentMessages,
          toolCallId: functionCallId,
        },
        createdAt: new Date(),
        creditCost,
        status: "pending" as const,
      };

      controller.enqueue(
        encoder.encode(
          JSON.stringify({
            type: "pending_action",
            data: {
              id: pendingAction.id,
              functionCall,
              message: pendingAction.message,
              conversationState: pendingAction.conversationState,
              creditCost,
            },
          }) + "\n"
        )
      );
      
      // 更新数据库中的消息和对话状态
      if (assistantMessageId && conversationId) {
        await updateMessage(assistantMessageId, {
          pendingAction: JSON.stringify(pendingAction),
          isStreaming: false,
          iterations: JSON.stringify(iterations),
        });
        await updateConversationStatus(conversationId, "awaiting_approval");
      }
      
      controller.enqueue(
        encoder.encode(
          JSON.stringify({
            type: "complete",
            data: "pending_confirmation",
          }) + "\n"
        )
      );
      return { completionType: 'pending_confirmation' };
    }

    // 发送执行状态
    controller.enqueue(
      encoder.encode(
        JSON.stringify({
          type: "function_start",
          data: {
            iterationNumber: iteration,
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
    
    // 更新当前迭代的function call状态
    currentIteration.functionCall = {
      id: functionCall.id,
      name: functionCall.name,
      description: funcDef.description,
      displayName: funcDef.displayName,
      category: functionCall.category,
      status: execResult.success ? "completed" : "failed",
      result: execResult.success ? "执行成功" : undefined,
      error: execResult.success ? undefined : execResult.error,
    };

    // 🔵 关键节点5：Function执行后，保存执行结果
    if (assistantMessageId) {
      await updateMessage(assistantMessageId, {
        iterations: JSON.stringify(iterations),
      });
    }

    // 发送执行结果
    controller.enqueue(
      encoder.encode(
        JSON.stringify({
          type: "function_result",
          data: {
            iterationNumber: iteration,
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
      return { completionType: 'error' };
    }
  }
}

