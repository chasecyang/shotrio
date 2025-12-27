/**
 * Agent Engine 状态管理（数据库操作）
 */

import db from "@/lib/db";
import { conversation, conversationMessage } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { collectContext } from "@/lib/actions/agent/context-collector";
import { buildSystemPrompt } from "./prompts";
import type { AgentContext } from "@/types/agent";
import type { ConversationState, Message, IterationInfo, PendingActionInfo } from "./types";

/**
 * 保存用户消息
 */
export async function saveUserMessage(conversationId: string, content: string): Promise<string> {
  const messageId = `msg_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.insert(conversationMessage).values({
    id: messageId,
    conversationId,
    role: "user",
    content,
    createdAt: new Date(),
  });

  return messageId;
}

/**
 * 创建 assistant 消息占位
 */
export async function createAssistantMessage(conversationId: string): Promise<string> {
  const messageId = `msg_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.insert(conversationMessage).values({
    id: messageId,
    conversationId,
    role: "assistant",
    content: "",
    createdAt: new Date(),
  });

  return messageId;
}

/**
 * 保存 assistant 响应
 */
export async function saveAssistantResponse(
  messageId: string,
  content: string,
  iterations: IterationInfo[]
): Promise<void> {
  await db
    .update(conversationMessage)
    .set({
      content,
      iterations: JSON.stringify(iterations),
    })
    .where(eq(conversationMessage.id, messageId));
}

/**
 * 更新对话状态
 */
export async function updateConversationStatus(
  conversationId: string,
  status: "active" | "awaiting_approval" | "completed"
): Promise<void> {
  await db
    .update(conversation)
    .set({
      status,
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    })
    .where(eq(conversation.id, conversationId));
}

/**
 * 保存对话上下文
 */
export async function saveConversationContext(
  conversationId: string,
  context: AgentContext
): Promise<void> {
  await db
    .update(conversation)
    .set({
      context: JSON.stringify(context),
      updatedAt: new Date(),
    })
    .where(eq(conversation.id, conversationId));
}

/**
 * 保存对话状态（用于恢复）
 */
export async function saveConversationState(state: ConversationState): Promise<void> {
  // 只保存 pendingAction 到数据库
  // 其他数据（messages, iterations）已经通过 conversationMessage 表保存
  await db
    .update(conversation)
    .set({
      pendingAction: state.pendingAction ? JSON.stringify(state.pendingAction) : null,
      updatedAt: new Date(),
    })
    .where(eq(conversation.id, state.conversationId));

  // 同时更新 assistant 消息的 iterations 和 content
  if (state.assistantMessageId && state.iterations.length > 0) {
    // 从最后一个 iteration 中获取 content
    const lastIteration = state.iterations[state.iterations.length - 1];
    const currentContent = lastIteration?.content || "";
    
    await saveAssistantResponse(
      state.assistantMessageId,
      currentContent,
      state.iterations
    );
  }
}

/**
 * 加载对话状态（从数据库重建）
 */
export async function loadConversationState(conversationId: string): Promise<ConversationState | null> {
  // 1. 查询对话基本信息和所有消息
  const conv = await db.query.conversation.findFirst({
    where: eq(conversation.id, conversationId),
    with: {
      messages: {
        orderBy: (messages, { asc }) => [asc(messages.createdAt)],
      },
    },
  });

  if (!conv) {
    return null;
  }

  try {
    // 2. 重建消息历史
    const messages: Message[] = [];
    
    // 添加系统消息
    messages.push({ role: "system", content: buildSystemPrompt() });
    
    // 添加项目上下文消息
    // 从数据库加载保存的上下文，如果没有则使用默认值
    let agentContext: AgentContext;
    if (conv.context) {
      try {
        agentContext = JSON.parse(conv.context) as AgentContext;
        // 确保 projectId 匹配（防止数据不一致）
        agentContext.projectId = conv.projectId;
      } catch (e) {
        console.warn("[AgentEngine] 解析保存的上下文失败，使用默认值:", e);
        agentContext = {
          projectId: conv.projectId,
          selectedEpisodeId: null,
          selectedShotIds: [],
          selectedResource: null,
          recentJobs: [],
        };
      }
    } else {
      // 旧对话没有保存上下文，使用默认值
      agentContext = {
        projectId: conv.projectId,
        selectedEpisodeId: null,
        selectedShotIds: [],
        selectedResource: null,
        recentJobs: [],
      };
    }
    const contextText = await collectContext(agentContext, conv.projectId);
    messages.push({ role: "system", content: `# 当前上下文\n\n${contextText}` });
    
    // 3. 先获取最后的 assistant 消息和解析 pendingAction（用于重建 tool_calls）
    const lastAssistantMsg = conv.messages
      .filter(m => m.role === "assistant")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    
    let pendingAction: PendingActionInfo | undefined;
    if (conv.pendingAction) {
      try {
        pendingAction = JSON.parse(conv.pendingAction);
      } catch (e) {
        console.warn("[AgentEngine] 解析 pendingAction 失败:", e);
      }
    }

    // 4. 重建对话消息
    for (const msg of conv.messages) {
      if (msg.role === "user") {
        messages.push({ role: "user", content: msg.content });
      } else if (msg.role === "assistant") {
        // 只有当这是最后一个 assistant 消息且有 pendingAction 时，才重建 tool_calls
        // 已完成的工具调用不应该包含 tool_calls（否则 OpenAI API 会要求紧跟 tool 消息）
        let toolCalls: Message["tool_calls"] = undefined;
        
        const isLastAssistantMsg = msg.id === lastAssistantMsg?.id;
        if (isLastAssistantMsg && pendingAction) {
          // 只有待确认的 pendingAction 需要 tool_calls
          toolCalls = [{
            id: pendingAction.functionCall.id,
            type: "function",
            function: {
              name: pendingAction.functionCall.name,
              arguments: JSON.stringify(pendingAction.functionCall.arguments || {}),
            },
          }];
        }
        // 已完成的工具调用不重建 tool_calls，避免 OpenAI API 报错
        
        messages.push({
          role: "assistant",
          content: msg.content,
          tool_calls: toolCalls,
        });
      }
      // tool 消息不需要重建到历史中，因为工具已经执行完成
    }

    // 5. 获取 iterations
    let iterations: IterationInfo[] = [];
    let currentIteration = 0;
    
    if (lastAssistantMsg?.iterations) {
      try {
        iterations = JSON.parse(lastAssistantMsg.iterations);
        currentIteration = iterations.length;
      } catch (e) {
        console.warn("[AgentEngine] 解析 iterations 失败:", e);
      }
    }

    return {
      conversationId,
      projectContext: agentContext, // 使用从数据库加载的上下文
      messages,
      iterations,
      currentIteration,
      pendingAction,
      assistantMessageId: lastAssistantMsg?.id,
    };
  } catch (error) {
    console.error("[AgentEngine] 加载对话状态失败:", error);
    return null;
  }
}

