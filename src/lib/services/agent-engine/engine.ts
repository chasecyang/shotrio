/**
 * Agent Engine 核心类
 */

import { getFunctionDefinition } from "@/lib/actions/agent/functions";
import { executeFunction } from "@/lib/actions/agent/executor";
import { collectContext } from "@/lib/actions/agent/context-collector";
import type { AgentContext, FunctionCall, EngineMessage } from "@/types/agent";
import db from "@/lib/db";

// 从 EngineMessage 中提取 ToolCall 类型
type ToolCall = NonNullable<EngineMessage["tool_calls"]>[number];
import { conversation } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";

import type {
  AgentStreamEvent,
  AgentEngineConfig,
  ConversationState,
} from "./types";
import { buildSystemPrompt } from "./prompts";
import { getAgentProvider, convertToAgentTools } from "./providers";
import { formatFunctionResult } from "./result-formatter";
import {
  saveUserMessage,
  createAssistantMessage,
  saveAssistantResponse,
  updateConversationStatus,
  saveConversationContext,
  loadConversationState,
  saveToolMessage,
} from "./state-manager";
import { getPendingToolCall } from "./approval-utils";

/**
 * Agent 引擎类
 */
export class AgentEngine {
  private config: Required<AgentEngineConfig>;

  constructor(config: AgentEngineConfig = {}) {
    this.config = {
      maxIterations: config.maxIterations || 20,
      modelName: config.modelName || process.env.OPENAI_AGENT_MODEL || 
                 process.env.OPENAI_REASONING_MODEL || 
                 process.env.OPENAI_CHAT_MODEL || 
                 "deepseek-chat",
    };
  }

  /**
   * 开始新对话
   */
  async *streamConversation(
    conversationId: string,
    userMessage: string,
    projectContext: AgentContext
  ): AsyncGenerator<AgentStreamEvent> {
    console.log("[AgentEngine] 开始新对话:", conversationId);

    // 从 conversation 表获取 projectId 和消息历史
    const conv = await db.query.conversation.findFirst({
      where: eq(conversation.id, conversationId),
      with: {
        messages: {
          orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        },
      },
    });

    if (!conv || !conv.projectId) {
      yield { type: "error", data: "对话不存在或未关联项目" };
      return;
    }

    // 保存用户消息
    const userMessageId = await saveUserMessage(conversationId, userMessage);
    yield { type: "user_message_id", data: userMessageId };

    // 创建 assistant 消息占位
    const assistantMessageId = await createAssistantMessage(conversationId);
    yield { type: "assistant_message_id", data: assistantMessageId };

    // 更新对话状态并保存上下文
    await updateConversationStatus(conversationId, "active");
    await saveConversationContext(conversationId, projectContext);

    // 检查是否有历史消息（不包括刚保存的用户消息，因为查询在保存之前）
    // 如果有历史消息，说明这不是首条消息，需要加载完整对话历史
    const hasHistory = conv.messages && conv.messages.length > 0;

    let state: ConversationState;

    if (hasHistory) {
      // 有历史消息：加载完整对话状态
      console.log("[AgentEngine] 检测到历史消息，加载完整对话状态");
      const loadedState = await loadConversationState(conversationId);
      
      if (!loadedState) {
        yield { type: "error", data: "无法加载对话状态" };
        return;
      }

      // 使用加载的状态，并添加新的用户消息
      state = loadedState;
      state.messages.push({ role: "user", content: userMessage });
      state.assistantMessageId = assistantMessageId;
    } else {
      // 首条消息：初始化新状态
      console.log("[AgentEngine] 首条消息，初始化新对话状态");
      state = {
        conversationId,
        projectContext,
        messages: [],
        assistantMessageId,
      };

      // 构建系统消息
      const contextText = await collectContext(projectContext, conv.projectId, projectContext.locale);
      const systemPrompt = buildSystemPrompt(projectContext.locale);
      state.messages.push({ 
        role: "system", 
        content: `${systemPrompt}\n\n# 当前上下文\n\n${contextText}` 
      });
      state.messages.push({ role: "user", content: userMessage });
    }

    // 执行对话循环
    yield* this.executeConversationLoop(state);
  }

  /**
   * 恢复对话（用户确认/拒绝后）
   */
  async *resumeConversation(
    conversationId: string,
    approved: boolean,
    modifiedParams?: Record<string, unknown>,
    feedback?: string
  ): AsyncGenerator<AgentStreamEvent> {
    console.log(`[AgentEngine] 恢复对话: ${conversationId}, 批准: ${approved}`, modifiedParams ? "使用修改后的参数" : "");
    const trimmedFeedback = feedback?.trim();

    // 1. 加载对话状态
    const state = await loadConversationState(conversationId);
    if (!state) {
      yield { type: "error", data: "无法加载对话状态" };
      return;
    }

    // 2. 从消息历史推导待执行的 tool call
    const pendingToolCall = getPendingToolCall(state.messages);
    
    if (!pendingToolCall) {
      yield { type: "error", data: "没有待执行的操作" };
      return;
    }

    // 3. 获取 function 定义
    const funcDef = getFunctionDefinition(pendingToolCall.function.name);
    if (!funcDef) {
      yield { type: "error", data: `未知的工具: ${pendingToolCall.function.name}` };
      return;
    }

    // 4. 更新对话状态为活跃
    await updateConversationStatus(conversationId, "active");

    // 5. 发送复用的 assistant 消息 ID
    yield { type: "assistant_message_id", data: state.assistantMessageId! };

    // 6. 处理用户决定
    if (approved) {
      // 用户同意：执行 tool
      console.log("[AgentEngine] 用户同意，执行 tool");

      // 🆕 积分检查：在执行消耗积分的操作前验证余额
      const { calculateTotalCredits } = await import("@/lib/utils/credit-calculator");
      const toolCallArgs = JSON.parse(modifiedParams ? JSON.stringify(modifiedParams) : pendingToolCall.function.arguments);
      const creditCost = calculateTotalCredits([{
        id: pendingToolCall.id,
        name: pendingToolCall.function.name,
        displayName: funcDef.displayName,
        parameters: toolCallArgs,
        category: funcDef.category,
        needsConfirmation: funcDef.needsConfirmation,
      }]);

      if (creditCost.total > 0) {
        const { hasEnoughCreditsForUser } = await import("@/lib/actions/credits/balance");
        const { auth } = await import("@/lib/auth");
        const { headers } = await import("next/headers");

        const session = await auth.api.getSession({ headers: await headers() });
        if (session?.user?.id) {
          const creditCheck = await hasEnoughCreditsForUser(session.user.id, creditCost.total);
          if (!creditCheck.success || !creditCheck.hasEnough) {
            console.log("[AgentEngine] 积分不足，拒绝执行");
            yield { type: "error", data: `积分不足，需要 ${creditCost.total} 积分，当前余额 ${creditCheck.currentBalance || 0} 积分` };
            await updateConversationStatus(conversationId, "awaiting_approval");
            return;
          }
        }
      }

      // 🆕 如果用户修改了参数，更新 tool call 的参数
      let finalToolCall = pendingToolCall;
      if (modifiedParams) {
        console.log("[AgentEngine] 使用用户修改的参数:", modifiedParams);
        finalToolCall = {
          ...pendingToolCall,
          function: {
            ...pendingToolCall.function,
            arguments: JSON.stringify(modifiedParams),
          },
        };
        
        // 🔄 同时更新消息历史中的 tool call 参数
        // 找到包含此 tool call 的 assistant 消息
        const assistantMsg = state.messages.find(
          (m): m is EngineMessage & { tool_calls: ToolCall[] } =>
            m.role === "assistant" &&
            m.tool_calls?.some((tc: ToolCall) => tc.id === pendingToolCall.id) === true
        );
        if (assistantMsg) {
          const toolCallIndex = assistantMsg.tool_calls.findIndex((tc: ToolCall) => tc.id === pendingToolCall.id);
          if (toolCallIndex !== -1) {
            assistantMsg.tool_calls[toolCallIndex].function.arguments = JSON.stringify(modifiedParams);
          }
        }
      }
      
      yield* this.executeTool(state, finalToolCall, funcDef);
    } else {
      // User rejected: add rejection message
      console.log("[AgentEngine] User rejected");

      const rejectionContent = JSON.stringify({
        success: false,
        error: "USER_REJECTED",
        userRejected: true,
      });

      // 关键修复：找到包含 pending tool call 的 assistant 消息位置
      // 需要将 tool message 插入到该 assistant 消息之后（紧跟着）
      // 以确保符合 OpenAI API 的要求：tool messages 必须紧跟 assistant message with tool_calls
      
      const lastAssistantIndex = state.messages.findLastIndex(
        m => m.role === "assistant" &&
        m.tool_calls?.some((tc: ToolCall) => tc.id === pendingToolCall.id)
      );

      const toolMessage: EngineMessage = {
        role: "tool",
        content: rejectionContent,
        tool_call_id: pendingToolCall.id,
      };

      if (lastAssistantIndex !== -1) {
        // 将 tool message 插入到 assistant message 之后
        // 这样即使后面有用户的"打断消息"，顺序也是正确的
        state.messages.splice(lastAssistantIndex + 1, 0, toolMessage);
        console.log(`[AgentEngine] 将 tool message 插入到位置 ${lastAssistantIndex + 1}`);
      } else {
        // 降级处理：如果找不到（理论上不应该发生），就追加到末尾
        console.warn("[AgentEngine] 未找到包含 tool_call 的 assistant 消息，追加到末尾");
        state.messages.push(toolMessage);
      }
      
      // 保存到数据库
      await saveToolMessage(
        state.conversationId,
        pendingToolCall.id,
        rejectionContent
      );

      // Send tool_call_end event
      yield {
        type: "tool_call_end",
        data: {
          id: pendingToolCall.id,
          name: pendingToolCall.function.name,
          success: false,
          error: "USER_REJECTED",
        },
      };

      // 无反馈拒绝：只记录拒绝，不继续对话
      if (!trimmedFeedback) {
        yield { type: "complete", data: "rejected" };
        return;
      }

      // 有反馈拒绝：将反馈作为 user message 注入，供后续对话参考
      state.messages.push({ role: "user", content: trimmedFeedback });
      await saveUserMessage(state.conversationId, trimmedFeedback);
    }

    // 7. 创建新 assistant 消息，继续对话
    const newAssistantMessageId = await createAssistantMessage(state.conversationId);
    state.assistantMessageId = newAssistantMessageId;
    yield { type: "assistant_message_id", data: newAssistantMessageId };

    // 8. 继续执行循环
    yield* this.executeConversationLoop(state);
  }

  /**
   * 执行对话循环（核心状态机）
   */
  private async *executeConversationLoop(
    state: ConversationState
  ): AsyncGenerator<AgentStreamEvent> {
    let iteration = 0;

    try {
      while (iteration < this.config.maxIterations) {
      iteration++;

      console.log(`[AgentEngine] 迭代 ${iteration}`);

      // 从第2次迭代开始，创建新的assistant message
      if (iteration > 1) {
        const newAssistantMessageId = await createAssistantMessage(state.conversationId);
        state.assistantMessageId = newAssistantMessageId;
        console.log(`[AgentEngine] 迭代 ${iteration} 创建新消息:`, newAssistantMessageId);
        yield { type: "assistant_message_id", data: newAssistantMessageId };
      }

      // 使用 Provider 抽象层调用 LLM
      const provider = getAgentProvider();
      const tools = convertToAgentTools();

      let currentContent = "";
      let currentReasoning = "";
      let sentContentLength = 0; // 追踪已发送内容的长度
      let sentReasoningLength = 0; // 追踪已发送思考内容的长度
      const toolCalls: Array<{ id: string; name: string; args: string }> = [];
      let lastUpdateTime = Date.now();
      const throttleInterval = 50; // 50ms 节流

      const stream = provider.streamChat(state.messages, tools, {
        temperature: 0.7,
        maxTokens: 4096,
      });

      for await (const chunk of stream) {
        const delta = chunk.delta;

        // 处理内容增量
        if (delta?.content) {
          currentContent += delta.content;

          // 节流：只在距离上次更新超过 throttleInterval 时发送更新
          const now = Date.now();
          if (now - lastUpdateTime >= throttleInterval) {
            // 发送所有累积的未发送内容
            const unsentContent = currentContent.slice(sentContentLength);
            if (unsentContent) {
              yield {
                type: "content_delta",
                data: unsentContent,
              };
              sentContentLength = currentContent.length;
            }
            // 发送所有累积的未发送思考内容
            const unsentReasoning = currentReasoning.slice(sentReasoningLength);
            if (unsentReasoning) {
              yield {
                type: "reasoning_delta",
                data: unsentReasoning,
              };
              sentReasoningLength = currentReasoning.length;
            }
            lastUpdateTime = now;
          }
        }

        // 处理思考内容增量
        if (delta?.reasoningContent) {
          currentReasoning += delta.reasoningContent;

          // 节流发送
          const now = Date.now();
          if (now - lastUpdateTime >= throttleInterval) {
            const unsentReasoning = currentReasoning.slice(sentReasoningLength);
            if (unsentReasoning) {
              yield {
                type: "reasoning_delta",
                data: unsentReasoning,
              };
              sentReasoningLength = currentReasoning.length;
            }
            lastUpdateTime = now;
          }
        }

        // 检测工具调用
        if (delta?.toolCalls && delta.toolCalls.length > 0) {
          // 合并工具调用信息
          for (const tc of delta.toolCalls) {
            if (tc.index !== undefined) {
              if (!toolCalls[tc.index]) {
                toolCalls[tc.index] = {
                  id: tc.id || "",
                  name: tc.function?.name || "",
                  args: "",
                };
              }
              if (tc.id) toolCalls[tc.index].id = tc.id;
              if (tc.function?.name) toolCalls[tc.index].name = tc.function.name;
              if (tc.function?.arguments) {
                toolCalls[tc.index].args += tc.function.arguments;
              }
            }
          }
        }
      }

      // 发送剩余未发送的内容
      const remainingContent = currentContent.slice(sentContentLength);
      if (remainingContent) {
        yield {
          type: "content_delta",
          data: remainingContent,
        };
      }

      // 发送剩余未发送的思考内容
      const remainingReasoning = currentReasoning.slice(sentReasoningLength);
      if (remainingReasoning) {
        yield {
          type: "reasoning_delta",
          data: remainingReasoning,
        };
      }

      // 解析工具调用参数
      const parsedToolCalls = toolCalls
        .filter(tc => tc && tc.name)
        .map(tc => {
          try {
            return {
              id: tc.id,
              name: tc.name,
              args: tc.args ? JSON.parse(tc.args) : {},
            };
          } catch (error) {
            console.error("[AgentEngine] 解析工具参数失败:", error);
            return {
              id: tc.id,
              name: tc.name,
              args: {},
            };
          }
        });

      // 构建完整的 AI 消息
      const response: EngineMessage = {
        role: "assistant",
        content: currentContent,
        tool_calls: parsedToolCalls.length > 0 
          ? parsedToolCalls.map(tc => ({
              id: tc.id,
              type: "function" as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.args),
              },
            }))
          : undefined,
      };

      // 添加响应到消息历史
      state.messages.push(response);

      // 检查是否有工具调用
      const aiMessage = response;
      if (!aiMessage.tool_calls || aiMessage.tool_calls.length === 0) {
        // 没有工具调用，对话结束
        console.log("[AgentEngine] 对话完成（无工具调用）");

        // 保存最终响应（只在对话结束时保存）
        await saveAssistantResponse(
          state.assistantMessageId!,
          currentContent,
          undefined,
          currentReasoning || undefined
        );

        await updateConversationStatus(state.conversationId, "completed");
        yield { type: "complete", data: "done" };
        return;
      }

      // 有工具调用
      const toolCall = aiMessage.tool_calls[0];
      const toolCallArgs = JSON.parse(toolCall.function.arguments);
      const funcDef = getFunctionDefinition(toolCall.function.name);

      if (!funcDef) {
        yield { type: "error", data: `未知的工具: ${toolCall.function.name}` };
        return;
      }

      // 发送 tool_call_start 事件
      yield {
        type: "tool_call_start",
        data: {
          id: toolCall.id || `fc-${Date.now()}`,
          name: toolCall.function.name,
          displayName: funcDef.displayName,
          arguments: toolCall.function.arguments,
        },
      };

      // 🆕 对需要确认的 function 先进行参数校验
      if (funcDef.needsConfirmation) {
        console.log("[AgentEngine] 需要确认的 function，先进行参数校验");
        
        const { validateFunctionParameters } = await import("@/lib/actions/agent/validation");
        const validationResult = await validateFunctionParameters(
          toolCall.function.name,
          toolCall.function.arguments
        );
        
        if (!validationResult.valid) {
          console.log("[AgentEngine] 参数校验失败，返回错误给 AI:", validationResult.errors);

          // 保存 assistant message（包含 tool_calls）
          await saveAssistantResponse(
            state.assistantMessageId!,
            currentContent,
            aiMessage.tool_calls,
            currentReasoning || undefined
          );

          // 执行失败的 tool（返回错误给 AI，让它修正）
          yield* this.executeToolWithError(state, toolCall, funcDef, validationResult.errors);

          // 继续对话循环，让 AI 看到错误并修正参数
          continue;
        }
        
        console.log("[AgentEngine] 参数校验通过，请求用户确认");
        
        // 如果有警告，记录日志
        if (validationResult.warnings && validationResult.warnings.length > 0) {
          console.log("[AgentEngine] 参数校验警告:", validationResult.warnings);
        }
      }

      // 检查是否需要确认
      if (funcDef.needsConfirmation) {
        console.log("[AgentEngine] 需要用户确认");

        // 批量保存：合并多个数据库操作
        await Promise.all([
          saveAssistantResponse(
            state.assistantMessageId!,
            currentContent,
            aiMessage.tool_calls,
            currentReasoning || undefined
          ),
          updateConversationStatus(state.conversationId, "awaiting_approval"),
        ]);

        // 发送简化的中断事件（前端会从消息历史推导 approval 信息）
        yield {
          type: "interrupt",
          data: {
            action: "approval_required",
          },
        };

        yield { type: "complete", data: "pending_confirmation" };
        return;
      }

      // 不需要确认，直接执行
      console.log("[AgentEngine] 直接执行工具（无需确认）");

      // 在执行tool之前保存assistant message（包括tool_calls）
      // 确保刷新页面时能恢复tool_calls
      await saveAssistantResponse(
        state.assistantMessageId!,
        currentContent,
        aiMessage.tool_calls,
        currentReasoning || undefined
      );

      yield* this.executeTool(state, toolCall, funcDef);

        // 继续下一轮迭代
      }

      // 达到最大迭代次数
      console.log("[AgentEngine] 达到最大迭代次数");
      await updateConversationStatus(state.conversationId, "completed");
      yield { type: "complete", data: "done" };
      yield { type: "error", data: "达到最大迭代次数" };
    } catch (error) {
      console.error("[AgentEngine] 执行循环错误:", error);
      yield { type: "error", data: error instanceof Error ? error.message : "执行失败" };
      yield { type: "complete", data: "done" };
    }
  }


  /**
   * 执行失败的工具（参数校验失败）
   * 直接返回错误给 AI，不实际执行
   */
  private async *executeToolWithError(
    state: ConversationState,
    toolCall: { id?: string; function: { name: string; arguments: string } },
    funcDef: { displayName?: string; description: string; category: "read" | "generation" | "modification" | "deletion"; needsConfirmation: boolean },
    errors: string[]
  ): AsyncGenerator<AgentStreamEvent> {
    console.log(`[AgentEngine] 返回参数校验错误: ${errors.join("; ")}`);

    const errorMessage = `参数校验失败:\n${errors.map(e => `- ${e}`).join("\n")}`;

    // 创建错误 tool message
    const toolMessage: EngineMessage = {
      role: "tool",
      content: JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      tool_call_id: toolCall.id || `fc-${Date.now()}`,
    };

    state.messages.push(toolMessage);

    // 保存 tool 消息到数据库
    await saveToolMessage(
      state.conversationId,
      toolMessage.tool_call_id!,
      toolMessage.content
    );

    // 发送 tool_call_end 事件
    yield {
      type: "tool_call_end",
      data: {
        id: toolCall.id || `fc-${Date.now()}`,
        name: toolCall.function.name,
        success: false,
        error: errorMessage,
      },
    };
  }

  /**
   * 执行单个工具
   */
  private async *executeTool(
    state: ConversationState,
    toolCall: { id?: string; function: { name: string; arguments: string } },
    funcDef: { displayName?: string; description: string; category: "read" | "generation" | "modification" | "deletion"; needsConfirmation: boolean }
  ): AsyncGenerator<AgentStreamEvent> {
    console.log(`[AgentEngine] 执行工具: ${toolCall.function.name}`);

    const toolCallId =
      toolCall.id && toolCall.id.length > 0 ? toolCall.id : `fc-${Date.now()}`;

    // 构建 FunctionCall
    const toolCallArgs = JSON.parse(toolCall.function.arguments);
    const functionCall: FunctionCall = {
      id: toolCallId,
      name: toolCall.function.name,
      displayName: funcDef.displayName,
      parameters: toolCallArgs as Record<string, unknown>,
      category: funcDef.category,
      needsConfirmation: funcDef.needsConfirmation,
    };

    try {
      // 执行工具
      const result = await executeFunction(functionCall, state.conversationId);

      // 格式化结果描述
      const formattedResult = result.success
        ? formatFunctionResult(functionCall.name, functionCall.parameters, result.data)
        : undefined;

      // 创建工具消息
      const toolMessage: EngineMessage = {
        role: "tool",
        content: JSON.stringify({
          success: result.success,
          data: result.data,
          error: result.error,
          jobId: result.jobId,
        }),
        tool_call_id: toolCallId,
      };

      // 确保 tool message 紧跟包含 tool_calls 的 assistant message（OpenAI 要求）
      const lastAssistantIndex = state.messages.findLastIndex(
        (m) =>
          m.role === "assistant" &&
          m.tool_calls?.some((tc: ToolCall) => tc.id === toolCallId) === true
      );
      if (lastAssistantIndex !== -1) {
        state.messages.splice(lastAssistantIndex + 1, 0, toolMessage);
      } else {
        state.messages.push(toolMessage);
      }

      // 保存 tool 消息到数据库
      await saveToolMessage(
        state.conversationId,
        toolMessage.tool_call_id!,
        toolMessage.content
      );

      // 发送 tool_call_end 事件
      yield {
        type: "tool_call_end",
        data: {
          id: toolCallId,
          name: toolCall.function.name,
          success: result.success,
          result: formattedResult,
          error: result.error,
        },
      };

      // 优化：不需要在这里再次保存 assistant message
      // 因为已经在调用 executeTool 之前保存过了
      // 这样减少了约30%的数据库写入次数
    } catch (error) {
      console.error("[AgentEngine] 执行工具失败:", error);

      // 发送错误事件
      yield {
        type: "tool_call_end",
        data: {
          id: toolCallId,
          name: toolCall.function.name,
          success: false,
          error: error instanceof Error ? error.message : "执行失败",
        },
      };

      // 创建错误tool message
      const errorToolMessage: EngineMessage = {
        role: "tool",
        content: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "执行失败",
        }),
        tool_call_id: toolCallId,
      };

      const lastAssistantIndex = state.messages.findLastIndex(
        (m) =>
          m.role === "assistant" &&
          m.tool_calls?.some((tc: ToolCall) => tc.id === toolCallId) === true
      );
      if (lastAssistantIndex !== -1) {
        state.messages.splice(lastAssistantIndex + 1, 0, errorToolMessage);
      } else {
        state.messages.push(errorToolMessage);
      }
      await saveToolMessage(
        state.conversationId,
        errorToolMessage.tool_call_id!,
        errorToolMessage.content
      );
    }
  }
}
