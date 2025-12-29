/**
 * Agent Engine 状态管理（数据库操作）
 */

import db from "@/lib/db";
import { conversation, conversationMessage } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { collectContext } from "@/lib/actions/agent/context-collector";
import { buildSystemPrompt } from "./prompts";
import { getFunctionDefinition } from "@/lib/actions/agent/functions";
import type { AgentContext } from "@/types/agent";
import type { ConversationState, Message, PendingActionInfo } from "./types";

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
  toolCalls?: Array<{id: string; type: "function"; function: {name: string; arguments: string}}>
): Promise<void> {
  await db
    .update(conversationMessage)
    .set({
      content,
      toolCalls: toolCalls ? JSON.stringify(toolCalls) : null,
    })
    .where(eq(conversationMessage.id, messageId));
}

/**
 * 保存 tool 消息
 */
export async function saveToolMessage(
  conversationId: string,
  toolCallId: string,
  content: string
): Promise<string> {
  const messageId = `msg_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.insert(conversationMessage).values({
    id: messageId,
    conversationId,
    role: "tool",
    content,
    toolCallId,
    createdAt: new Date(),
  });

  return messageId;
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
    
    // 3. 先获取最后的 assistant 消息（messages 已按 createdAt asc 排序）
    const lastAssistantMsg = conv.messages
      .filter(m => m.role === "assistant")
      .at(-1);

    // 4. 重建对话消息
    for (const msg of conv.messages) {
      if (msg.role === "user") {
        messages.push({ role: "user", content: msg.content });
      } else if (msg.role === "assistant") {
        // 从数据库读取 tool_calls
        let toolCalls: Message["tool_calls"] = undefined;
        if (msg.toolCalls) {
          try {
            toolCalls = JSON.parse(msg.toolCalls);
          } catch (e) {
            console.warn("[AgentEngine] 解析 toolCalls 失败:", e);
          }
        }
        
        messages.push({
          role: "assistant",
          content: msg.content,
          tool_calls: toolCalls,
        });
      } else if (msg.role === "tool") {
        // 重建 tool 消息
        messages.push({
          role: "tool",
          content: msg.content,
          tool_call_id: msg.toolCallId!,
        });
      }
    }
    
    // 5. 从消息历史推导 pendingAction（Event Sourcing）
    const pendingAction = derivePendingAction(messages, conv.status);

    return {
      conversationId,
      projectContext: agentContext,
      messages,
      pendingAction,
      assistantMessageId: lastAssistantMsg?.id,
    };
  } catch (error) {
    console.error("[AgentEngine] 加载对话状态失败:", error);
    return null;
  }
}

/**
 * 从消息历史推导 pendingAction（Event Sourcing）
 * 
 * 规则：
 * 1. 只有 status === "awaiting_approval" 时才可能有 pending
 * 2. 找到最后一条 assistant 消息的 tool_calls
 * 3. 如果 tool call 没有对应的 tool message，且 needsConfirmation === true，则为 pending
 */
export function derivePendingAction(
  messages: Message[],
  conversationStatus: string
): PendingActionInfo | undefined {
  // 关键检查1：只有等待确认状态才检查
  if (conversationStatus !== "awaiting_approval") {
    return undefined;
  }

  // 找到最后一条 assistant 消息
  const lastAssistant = messages
    .filter(m => m.role === "assistant")
    .sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    })[0];

  if (!lastAssistant?.tool_calls?.length) {
    return undefined;
  }

  // 找出没有对应 tool message 的 tool call
  const pendingToolCall = lastAssistant.tool_calls.find(tc => {
    // 检查是否有对应的 tool message（墓碑标记）
    const hasToolMessage = messages.some(m => 
      m.role === "tool" && 
      m.tool_call_id === tc.id
    );
    
    if (hasToolMessage) {
      return false; // 已经有 tool message，不是 pending
    }
    
    // 关键检查2：只有需要确认的 function 才算 pending
    const funcDef = getFunctionDefinition(tc.function.name);
    return funcDef?.needsConfirmation === true;
  });

  if (!pendingToolCall) {
    return undefined;
  }

  // 重建 PendingActionInfo
  const funcDef = getFunctionDefinition(pendingToolCall.function.name);
  const args = JSON.parse(pendingToolCall.function.arguments);
  
  return {
    id: pendingToolCall.id,
    functionCall: {
      id: pendingToolCall.id,
      name: pendingToolCall.function.name,
      displayName: funcDef?.displayName,
      arguments: args,
      category: funcDef?.category || "generation",
    },
    message: lastAssistant.content || `准备执行: ${funcDef?.displayName || pendingToolCall.function.name}`,
    // creditCost 不推导，由前端重新计算
    createdAt: new Date(),
  };
}

