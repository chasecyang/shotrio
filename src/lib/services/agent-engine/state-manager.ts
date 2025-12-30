/**
 * Agent Engine 状态管理（数据库操作）
 */

import db from "@/lib/db";
import { conversation, conversationMessage } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { collectContext } from "@/lib/actions/agent/context-collector";
import { buildSystemPrompt } from "./prompts";
import { getFunctionDefinition } from "@/lib/actions/agent/functions";
import { estimateActionCredits } from "@/lib/actions/credits/estimate";
import type { AgentContext, AgentMessage, FunctionCall } from "@/types/agent";
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
  try {
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
      console.error("[loadConversationState] 对话不存在:", conversationId);
      return null;
    }

    console.log(`[loadConversationState] 加载对话: ${conversationId}, 状态: ${conv.status}, 消息数: ${conv.messages.length}`);
  
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
    
    // 状态不一致检查和修复（异步，不阻塞返回）
    if (!pendingAction && conv.status === "awaiting_approval") {
      console.warn("[loadConversationState] 状态不一致，修复: awaiting_approval -> active");
      db.update(conversation)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(conversation.id, conversationId))
        .catch(err => console.error("[loadConversationState] 修复状态失败:", err));
    }

    return {
      conversationId,
      projectContext: agentContext,
      messages,
      pendingAction,
      assistantMessageId: lastAssistantMsg?.id,
    };
  } catch (error) {
    console.error("[loadConversationState] 加载失败:", error);
    return null;
  }
  } catch (error) {
    console.error("[loadConversationState] 查询失败:", error);
    return null;
  }
}

/**
 * 核心推导逻辑：从消息中找到待确认的 tool call
 */
function findPendingToolCall(messages: Array<AgentMessage | Message>): {
  toolCall: { id: string; function: { name: string; arguments: string } };
  assistantContent: string;
} | null {
  // 找到最后一条 assistant 消息
  const lastAssistant = messages
    .filter(m => m.role === "assistant")
    .sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    })[0];

  if (!lastAssistant?.toolCalls?.length) {
    return null;
  }

  // 找出没有对应 tool message 且需要确认的 tool call
  const pendingToolCall = lastAssistant.toolCalls.find(tc => {
    const hasToolMessage = messages.some(m => 
      m.role === "tool" && m.toolCallId === tc.id
    );
    if (hasToolMessage) return false;
    
    const funcDef = getFunctionDefinition(tc.function.name);
    return funcDef?.needsConfirmation === true;
  });

  if (!pendingToolCall) {
    return null;
  }

  return {
    toolCall: pendingToolCall,
    assistantContent: lastAssistant.content || "",
  };
}

/**
 * 构建 PendingActionInfo
 */
function buildPendingAction(
  toolCall: { id: string; function: { name: string; arguments: string } },
  assistantContent: string
): PendingActionInfo {
  const funcDef = getFunctionDefinition(toolCall.function.name);
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch {
    args = {};
  }
  
  return {
    id: toolCall.id,
    functionCall: {
      id: toolCall.id,
      name: toolCall.function.name,
      displayName: funcDef?.displayName,
      arguments: args,
      category: funcDef?.category || "generation",
    },
    message: assistantContent || `准备执行: ${funcDef?.displayName || toolCall.function.name}`,
    createdAt: new Date(),
  };
}

/**
 * 从消息历史推导 pendingAction（异步版本，支持积分计算）
 */
export async function derivePendingActionFromMessages(
  messages: Array<AgentMessage | Message>,
  conversationStatus: string,
  recalculateCreditCost: boolean = false
): Promise<PendingActionInfo | undefined> {
  if (conversationStatus !== "awaiting_approval") {
    return undefined;
  }

  const result = findPendingToolCall(messages);
  if (!result) {
    return undefined;
  }

  const pendingAction = buildPendingAction(result.toolCall, result.assistantContent);

  // 重新计算积分成本
  if (recalculateCreditCost) {
    try {
      const funcDef = getFunctionDefinition(result.toolCall.function.name);
      const functionCall: FunctionCall = {
        id: result.toolCall.id,
        name: result.toolCall.function.name,
        displayName: funcDef?.displayName,
        parameters: pendingAction.functionCall.arguments,
        category: funcDef?.category || "generation",
        needsConfirmation: funcDef?.needsConfirmation || false,
      };
      const estimateResult = await estimateActionCredits([functionCall]);
      if (estimateResult.success && estimateResult.creditCost) {
        pendingAction.creditCost = estimateResult.creditCost;
      }
    } catch (error) {
      console.error("[derivePendingAction] 估算积分失败:", error);
    }
  }

  return pendingAction;
}

/**
 * 从消息历史推导 pendingAction（同步版本，向后兼容）
 */
export function derivePendingAction(
  messages: Message[],
  conversationStatus: string
): PendingActionInfo | undefined {
  if (conversationStatus !== "awaiting_approval") {
    return undefined;
  }

  const result = findPendingToolCall(messages);
  return result ? buildPendingAction(result.toolCall, result.assistantContent) : undefined;
}

