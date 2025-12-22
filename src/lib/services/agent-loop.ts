/**
 * Agent Loop 共享逻辑
 * 
 * 提供可复用的 Agent 执行循环，供 chat-stream 和 resume-stream 使用
 */

import { getChatCompletionWithFunctionsStream } from "./openai.service";
import { AGENT_FUNCTIONS, toOpenAIFunctionFormat, getFunctionDefinition } from "../actions/agent/functions";
import { executeFunction } from "../actions/agent/executor";
import { estimateActionCredits } from "../actions/credits/estimate";
import type { FunctionCall } from "@/types/agent";

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
 * @param maxIterations - 最大迭代次数
 */
export async function runAgentLoop(
  currentMessages: Message[],
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  maxIterations: number = 5
): Promise<void> {
  const functions = toOpenAIFunctionFormat(AGENT_FUNCTIONS);

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
      console.error("[Agent Loop] AI 调用失败:", streamError);
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

      controller.enqueue(
        encoder.encode(
          JSON.stringify({
            type: "pending_action",
            data: {
              id: `action-${Date.now()}`,
              functionCall,
              message: accumulatedContent || `准备执行: ${functionCall.name}`,
              conversationState: {
                messages: currentMessages,
                toolCallId: functionCallId,
              },
              creditCost,
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
}

