/**
 * Agent Engine 核心类
 */

import OpenAI from "openai";
import { getFunctionDefinition } from "@/lib/actions/agent/functions";
import { executeFunction } from "@/lib/actions/agent/executor";
import { collectContext } from "@/lib/actions/agent/context-collector";
import { estimateActionCredits } from "@/lib/actions/credits/estimate";
import type { AgentContext, FunctionCall } from "@/types/agent";
import db from "@/lib/db";
import { conversation } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";

import type {
  AgentStreamEvent,
  AgentEngineConfig,
  ConversationState,
  IterationInfo,
  PendingActionInfo,
  Message,
} from "./types";
import { buildSystemPrompt } from "./prompts";
import { convertToOpenAITools, getOpenAIClient } from "./openai-utils";
import { formatFunctionResult } from "./result-formatter";
import {
  saveUserMessage,
  createAssistantMessage,
  saveAssistantResponse,
  updateConversationStatus,
  saveConversationContext,
  saveConversationState,
  loadConversationState,
} from "./state-manager";

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
        iterations: [],
        currentIteration: 0,
        assistantMessageId,
      };

      // 构建系统消息
      const contextText = await collectContext(projectContext, conv.projectId);
      const systemPrompt = buildSystemPrompt();
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
    reason?: string
  ): AsyncGenerator<AgentStreamEvent> {
    console.log(`[AgentEngine] 恢复对话: ${conversationId}, 批准: ${approved}`);

    // 加载对话状态
    const state = await loadConversationState(conversationId);
    if (!state) {
      yield { type: "error", data: "无法加载对话状态" };
      return;
    }

    // 发送 assistant 消息ID（复用已有消息）
    yield { type: "assistant_message_id", data: state.assistantMessageId! };

    // 更新对话状态
    await updateConversationStatus(conversationId, "active");

    // 处理用户决定
    if (!approved) {
      // 用户拒绝，添加拒绝消息
      if (state.pendingAction) {
        // 1. 添加 tool 消息（标记操作失败）
        const toolMessage: Message = {
          role: "tool",
          content: JSON.stringify({
            success: false,
            error: "用户拒绝了此操作",
            userRejected: true,
          }),
          tool_call_id: state.pendingAction.functionCall.id,
        };
        state.messages.push(toolMessage);

        // 2. 如果用户提供了拒绝理由（新消息），添加为用户消息
        // 这样 AI 可以看到用户的新输入并据此回复
        if (reason && reason !== "用户拒绝了此操作") {
          state.messages.push({ role: "user", content: reason });
        }

        // 3. 更新迭代状态
        const lastIteration = state.iterations[state.iterations.length - 1];
        if (lastIteration) {
          lastIteration.functionCall = {
            id: state.pendingAction.functionCall.id,
            name: state.pendingAction.functionCall.name,
            displayName: state.pendingAction.functionCall.displayName,
            description: "",
            category: state.pendingAction.functionCall.category,
            status: "failed",
            error: reason || "用户拒绝了此操作",
          };
        }

        // 4. 清除 pendingAction
        state.pendingAction = undefined;

        // 5. 发送状态更新（明确清除前端 pendingAction）
        yield {
          type: "state_update",
          data: {
            iterations: state.iterations,
            currentIteration: state.currentIteration,
            pendingAction: undefined, // 明确清除
          },
        };
      }
      
      // 继续执行循环（让 AI 根据拒绝原因或新消息调整策略）
      yield* this.executeConversationLoop(state);
    } else {
      // 用户同意，执行 pendingAction
      if (state.pendingAction) {
        yield* this.executeToolAndContinue(state);
      } else {
        yield { type: "error", data: "没有待执行的操作" };
      }
    }
  }

  /**
   * 执行对话循环（核心状态机）
   */
  private async *executeConversationLoop(
    state: ConversationState
  ): AsyncGenerator<AgentStreamEvent> {
    let iteration = 0;

    while (iteration < this.config.maxIterations) {
      iteration++;
      state.currentIteration++;

      console.log(`[AgentEngine] 迭代 ${state.currentIteration}`);

      // 创建新的迭代记录
      const iterationInfo: IterationInfo = {
        id: `iter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        iterationNumber: state.currentIteration,
        timestamp: new Date(),
      };
      state.iterations.push(iterationInfo);

      // 调用 OpenAI (流式)
      const openai = getOpenAIClient();
      
      // 使用原生 OpenAI 流式输出
      let currentContent = "";
      const toolCalls: Array<{ id: string; name: string; args: string }> = [];
      let lastUpdateTime = Date.now();
      const throttleInterval = 50; // 50ms 节流
      
      const stream = await openai.chat.completions.create({
        model: this.config.modelName,
        messages: state.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools: convertToOpenAITools(),
        temperature: 0.7,
        max_tokens: 4096,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        
        // 处理内容增量
        if (delta?.content) {
          currentContent += delta.content;
          iterationInfo.content = currentContent;
          
          // 节流：只在距离上次更新超过 throttleInterval 时发送更新
          const now = Date.now();
          if (now - lastUpdateTime >= throttleInterval) {
            yield {
              type: "state_update",
              data: {
                iterations: state.iterations,
                currentIteration: state.currentIteration,
              },
            };
            lastUpdateTime = now;
          }
        }
        
        // 检测工具调用
        if (delta?.tool_calls && delta.tool_calls.length > 0) {
          // 合并工具调用信息
          for (const tc of delta.tool_calls) {
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

      // 流式完成后，发送最后一次更新
      yield {
        type: "state_update",
        data: {
          iterations: state.iterations,
          currentIteration: state.currentIteration,
        },
      };

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
      const response: Message = {
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

        // 保存最终响应
        await saveAssistantResponse(
          state.assistantMessageId!,
          iterationInfo.content || "",
          state.iterations
        );

        yield {
          type: "state_update",
          data: {
            iterations: state.iterations,
            currentIteration: state.currentIteration,
          },
        };

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

      // 检查是否需要确认
      if (funcDef.needsConfirmation) {
        console.log("[AgentEngine] 需要用户确认");

        // 估算积分
        let creditCost;
        try {
          const functionCall: FunctionCall = {
            id: toolCall.id || `fc-${Date.now()}`,
            name: toolCall.function.name,
            displayName: funcDef.displayName,
            parameters: toolCallArgs as Record<string, unknown>,
            category: funcDef.category,
            needsConfirmation: funcDef.needsConfirmation,
          };
          const estimateResult = await estimateActionCredits([functionCall]);
          if (estimateResult.success && estimateResult.creditCost) {
            creditCost = estimateResult.creditCost;
          }
        } catch (error) {
          console.error("[AgentEngine] 估算积分失败:", error);
        }

        // 创建 pendingAction
        const pendingAction: PendingActionInfo = {
          id: `action-${Date.now()}`,
          functionCall: {
            id: toolCall.id || `fc-${Date.now()}`,
            name: toolCall.function.name,
            displayName: funcDef.displayName,
            arguments: toolCallArgs as Record<string, unknown>,
            category: funcDef.category,
          },
          message: iterationInfo.content || `准备执行: ${funcDef.displayName || toolCall.function.name}`,
          creditCost,
          createdAt: new Date(),
        };

        state.pendingAction = pendingAction;

        // 保存状态到数据库
        await saveConversationState(state);
        await updateConversationStatus(state.conversationId, "awaiting_approval");

        // 发送中断事件
        yield {
          type: "state_update",
          data: {
            iterations: state.iterations,
            currentIteration: state.currentIteration,
            pendingAction,
          },
        };

        yield {
          type: "interrupt",
          data: {
            action: "approval_required",
            pendingAction,
          },
        };

        yield { type: "complete", data: "pending_confirmation" };
        return;
      }

      // 不需要确认，直接执行
      console.log("[AgentEngine] 直接执行工具（无需确认）");
      yield* this.executeTool(state, toolCall, funcDef, iterationInfo);

      // 继续下一轮迭代
    }

    // 达到最大迭代次数
    console.log("[AgentEngine] 达到最大迭代次数");
    await updateConversationStatus(state.conversationId, "completed");
    yield { type: "error", data: "达到最大迭代次数" };
  }

  /**
   * 执行工具并继续
   */
  private async *executeToolAndContinue(
    state: ConversationState
  ): AsyncGenerator<AgentStreamEvent> {
    if (!state.pendingAction) {
      yield { type: "error", data: "没有待执行的操作" };
      return;
    }

    // 找到对应的 AI 消息和 tool_call
    const lastAIMessage = [...state.messages].reverse().find(m => m.role === "assistant");
    if (!lastAIMessage || !lastAIMessage.tool_calls || lastAIMessage.tool_calls.length === 0) {
      yield { type: "error", data: "无法找到工具调用信息" };
      return;
    }

    const toolCall = lastAIMessage.tool_calls[0];
    const funcDef = getFunctionDefinition(toolCall.function.name);
    if (!funcDef) {
      yield { type: "error", data: `未知的工具: ${toolCall.function.name}` };
      return;
    }

    const lastIteration = state.iterations[state.iterations.length - 1];

    // 执行工具
    yield* this.executeTool(state, toolCall, funcDef, lastIteration);

    // 清除 pendingAction
    state.pendingAction = undefined;

    // 继续执行循环
    yield* this.executeConversationLoop(state);
  }

  /**
   * 执行单个工具
   */
  private async *executeTool(
    state: ConversationState,
    toolCall: { id?: string; function: { name: string; arguments: string } },
    funcDef: { displayName?: string; description: string; category: "read" | "generation" | "modification" | "deletion"; needsConfirmation: boolean },
    iterationInfo: IterationInfo
  ): AsyncGenerator<AgentStreamEvent> {
    console.log(`[AgentEngine] 执行工具: ${toolCall.function.name}`);

    // 构建 FunctionCall
    const toolCallArgs = JSON.parse(toolCall.function.arguments);
    const functionCall: FunctionCall = {
      id: toolCall.id || `fc-${Date.now()}`,
      name: toolCall.function.name,
      displayName: funcDef.displayName,
      parameters: toolCallArgs as Record<string, unknown>,
      category: funcDef.category,
      needsConfirmation: funcDef.needsConfirmation,
    };

    // 执行工具
    const result = await executeFunction(functionCall, state.conversationId);

    // 格式化结果描述
    const formattedResult = result.success
      ? formatFunctionResult(functionCall.name, functionCall.parameters, result.data)
      : undefined;

    // 更新迭代状态
    iterationInfo.functionCall = {
      id: functionCall.id,
      name: functionCall.name,
      displayName: funcDef.displayName,
      description: funcDef.description,
      category: functionCall.category,
      status: result.success ? "completed" : "failed",
      result: formattedResult || (result.success ? "执行成功" : undefined),
      error: result.success ? undefined : result.error,
    };

    // 创建工具消息
    const toolMessage: Message = {
      role: "tool",
      content: JSON.stringify({
        success: result.success,
        data: result.data,
        error: result.error,
        jobId: result.jobId,
      }),
      tool_call_id: toolCall.id || `fc-${Date.now()}`,
    };

    state.messages.push(toolMessage);

    // 发送状态更新
    yield {
      type: "state_update",
      data: {
        iterations: state.iterations,
        currentIteration: state.currentIteration,
      },
    };

    // 保存中间状态
    await saveAssistantResponse(
      state.assistantMessageId!,
      "",
      state.iterations
    );
  }
}

