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
  loadConversationState,
  saveToolMessage,
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
    approved: boolean
  ): AsyncGenerator<AgentStreamEvent> {
    console.log(`[AgentEngine] 恢复对话: ${conversationId}, 批准: ${approved}`);

    // 加载对话状态
    const state = await loadConversationState(conversationId);
    if (!state) {
      yield { type: "error", data: "无法加载对话状态" };
      return;
    }

    // 状态一致性验证
    if (approved && !state.pendingAction) {
      yield { type: "error", data: "没有待执行的操作" };
      return;
    }

    // 更新对话状态为活跃
    await updateConversationStatus(conversationId, "active");

    // 处理用户决定
    if (!approved) {
      // 用户拒绝，为所有 tool_calls 添加拒绝消息
      // 找到最后一条 assistant 消息
      const lastAssistantMessage = [...state.messages]
        .reverse()
        .find(m => m.role === "assistant");

      if (lastAssistantMessage?.tool_calls && lastAssistantMessage.tool_calls.length > 0) {
        // 为所有 tool_calls 创建拒绝的 tool message
        console.log(`[AgentEngine] 为 ${lastAssistantMessage.tool_calls.length} 个 tool_calls 添加拒绝消息`);
        
        // 批量创建拒绝消息
        const rejectionContent = JSON.stringify({
          success: false,
          error: "用户拒绝了此操作",
          userRejected: true,
        });

        // 并行保存所有 tool messages
        const savePromises = lastAssistantMessage.tool_calls.map(async (toolCall) => {
          // 1. 添加 tool message（墓碑标记）
          const toolMessage: Message = {
            role: "tool",
            content: rejectionContent,
            tool_call_id: toolCall.id,
          };
          state.messages.push(toolMessage);
          
          // 2. 保存 tool 消息到数据库
          await saveToolMessage(
            state.conversationId,
            toolMessage.tool_call_id!,
            toolMessage.content
          );

          return toolCall;
        });

        // 等待所有保存完成
        const rejectedToolCalls = await Promise.all(savePromises);

        // 3. 发送所有 tool_call_end 事件
        for (const toolCall of rejectedToolCalls) {
          yield {
            type: "tool_call_end",
            data: {
              id: toolCall.id,
              name: toolCall.function.name,
              success: false,
              error: "用户拒绝了此操作",
            },
          };
        }
      } else if (state.pendingAction) {
        // 降级逻辑：如果没有找到 assistant 消息的 tool_calls，使用 pendingAction
        console.warn("[AgentEngine] 未找到 assistant 消息的 tool_calls，使用 pendingAction 降级处理");
        
        const rejectedToolCallId = state.pendingAction.functionCall.id;
        const rejectedToolCallName = state.pendingAction.functionCall.name;

        // 1. 添加 tool message（墓碑标记）
        const toolMessage: Message = {
          role: "tool",
          content: JSON.stringify({
            success: false,
            error: "用户拒绝了此操作",
            userRejected: true,
          }),
          tool_call_id: rejectedToolCallId,
        };
        state.messages.push(toolMessage);
        
        // 保存 tool 消息到数据库
        await saveToolMessage(
          state.conversationId,
          toolMessage.tool_call_id!,
          toolMessage.content
        );

        // 2. 发送 tool_call_end 事件
        yield {
          type: "tool_call_end",
          data: {
            id: rejectedToolCallId,
            name: rejectedToolCallName,
            success: false,
            error: "用户拒绝了此操作",
          },
        };
      }
      
      // 3. 创建新的 assistant message（拒绝后的新响应）
      const newAssistantMessageId = await createAssistantMessage(state.conversationId);
      state.assistantMessageId = newAssistantMessageId;
      
      // 4. 发送新的 assistant_message_id 事件
      yield { type: "assistant_message_id", data: newAssistantMessageId };
      
      // 5. 继续执行循环（让 AI 根据拒绝做出回应）
      yield* this.executeConversationLoop(state);
    } else {
      // 用户同意，执行 pendingAction
      // 发送 assistant 消息ID（复用已有消息）
      yield { type: "assistant_message_id", data: state.assistantMessageId! };
      
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

      // 调用 OpenAI (流式)
      const openai = getOpenAIClient();
      
      // 使用原生 OpenAI 流式输出
      let currentContent = "";
      let sentContentLength = 0; // 追踪已发送内容的长度
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

      // 发送剩余未发送的内容
      const remainingContent = currentContent.slice(sentContentLength);
      if (remainingContent) {
        yield {
          type: "content_delta",
          data: remainingContent,
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

        // 保存最终响应（只在对话结束时保存）
        await saveAssistantResponse(
          state.assistantMessageId!,
          currentContent,
          undefined
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
        },
      };

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
          message: currentContent || `准备执行: ${funcDef.displayName || toolCall.function.name}`,
          creditCost,
          createdAt: new Date(),
        };

        state.pendingAction = pendingAction;

        // 批量保存：合并多个数据库操作
        await Promise.all([
          saveAssistantResponse(
            state.assistantMessageId!,
            currentContent,
            aiMessage.tool_calls
          ),
          updateConversationStatus(state.conversationId, "awaiting_approval"),
        ]);

        // 发送中断事件
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
      
      // 在执行tool之前保存assistant message（包括tool_calls）
      // 确保刷新页面时能恢复tool_calls
      await saveAssistantResponse(
        state.assistantMessageId!,
        currentContent,
        aiMessage.tool_calls
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

    // 执行工具
    yield* this.executeTool(state, toolCall, funcDef);

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
    funcDef: { displayName?: string; description: string; category: "read" | "generation" | "modification" | "deletion"; needsConfirmation: boolean }
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

    try {
      // 执行工具
      const result = await executeFunction(functionCall, state.conversationId);

      // 格式化结果描述
      const formattedResult = result.success
        ? formatFunctionResult(functionCall.name, functionCall.parameters, result.data)
        : undefined;

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
          id: toolCall.id || `fc-${Date.now()}`,
          name: toolCall.function.name,
          success: false,
          error: error instanceof Error ? error.message : "执行失败",
        },
      };

      // 创建错误tool message
      const errorToolMessage: Message = {
        role: "tool",
        content: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "执行失败",
        }),
        tool_call_id: toolCall.id || `fc-${Date.now()}`,
      };

      state.messages.push(errorToolMessage);
      await saveToolMessage(
        state.conversationId,
        errorToolMessage.tool_call_id!,
        errorToolMessage.content
      );
    }
  }
}

