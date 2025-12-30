/**
 * Agent Engine 核心类
 */

import OpenAI from "openai";
import { getFunctionDefinition } from "@/lib/actions/agent/functions";
import { executeFunction } from "@/lib/actions/agent/executor";
import { collectContext } from "@/lib/actions/agent/context-collector";
import type { AgentContext, FunctionCall } from "@/types/agent";
import db from "@/lib/db";
import { conversation } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";

import type {
  AgentStreamEvent,
  AgentEngineConfig,
  ConversationState,
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
      yield* this.executeTool(state, pendingToolCall, funcDef);
    } else {
      // 用户拒绝：添加 rejection 消息
      console.log("[AgentEngine] 用户拒绝");
      
      const rejectionContent = JSON.stringify({
        success: false,
        error: "用户拒绝了此操作",
        userRejected: true,
      });

      // 添加 tool message（墓碑标记）
      const toolMessage: Message = {
        role: "tool",
        content: rejectionContent,
        tool_call_id: pendingToolCall.id,
      };
      state.messages.push(toolMessage);
      
      // 保存到数据库
      await saveToolMessage(
        state.conversationId,
        pendingToolCall.id,
        rejectionContent
      );

      // 发送 tool_call_end 事件
      yield {
        type: "tool_call_end",
        data: {
          id: pendingToolCall.id,
          name: pendingToolCall.function.name,
          success: false,
          error: "用户拒绝了此操作",
        },
      };
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

      // 调用 OpenAI (流式)
      const openai = getOpenAIClient();
      
      // 使用原生 OpenAI 流式输出
      let currentContent = "";
      let sentContentLength = 0; // 追踪已发送内容的长度
      const toolCalls: Array<{ id: string; name: string; args: string }> = [];
      let lastUpdateTime = Date.now();
      const throttleInterval = 15; // 15ms 节流
      
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
          arguments: toolCall.function.arguments,
        },
      };

      // 检查是否需要确认
      if (funcDef.needsConfirmation) {
        console.log("[AgentEngine] 需要用户确认");

        // 批量保存：合并多个数据库操作
        await Promise.all([
          saveAssistantResponse(
            state.assistantMessageId!,
            currentContent,
            aiMessage.tool_calls
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

