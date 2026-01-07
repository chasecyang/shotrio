/**
 * Agent Engine 状态管理（数据库操作）
 */

import db from "@/lib/db";
import { conversation, conversationMessage } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { collectContext } from "@/lib/actions/agent/context-collector";
import { buildSystemPrompt } from "./prompts";
import type { AgentContext, EngineMessage } from "@/types/agent";
import type { ConversationState } from "./types";
import { isAwaitingApproval } from "./approval-utils";

/**
 * 确保消息顺序符合 OpenAI API 要求
 * 每个包含 tool_calls 的 assistant 消息后面必须紧跟对应的 tool 消息
 *
 * 问题场景：用户打断 agent 时，打断消息先保存（T1），rejection消息后保存（T2）
 * 按时间排序后变成：assistant(tool_call) → user(打断) → tool(rejection)
 * 但 OpenAI 要求：assistant(tool_call) → tool(rejection) → user(打断)
 */
function ensureToolCallOrder(messages: EngineMessage[]): EngineMessage[] {
  const result: EngineMessage[] = [];
  const usedToolMessageIndices = new Set<number>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // 跳过已经被移动的 tool 消息
    if (usedToolMessageIndices.has(i)) continue;

    result.push(msg);

    // 如果是包含 tool_calls 的 assistant 消息
    if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
      const toolCallIds = new Set(msg.tool_calls.map(tc => tc.id));

      // 查找并收集所有对应的 tool 消息（可能在后面的任意位置）
      for (let j = i + 1; j < messages.length; j++) {
        const laterMsg = messages[j];
        if (laterMsg.role === "tool" &&
            laterMsg.tool_call_id &&
            toolCallIds.has(laterMsg.tool_call_id) &&
            !usedToolMessageIndices.has(j)) {
          result.push(laterMsg);
          usedToolMessageIndices.add(j);
          toolCallIds.delete(laterMsg.tool_call_id);
        }
      }
    }
  }

  return result;
}

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

    // 2. 重建消息历史
    const messages: EngineMessage[] = [];
    
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
          recentJobs: [],
        };
      }
    } else {
      // 旧对话没有保存上下文，使用默认值
      agentContext = {
        projectId: conv.projectId,
        recentJobs: [],
      };
    }
    const contextText = await collectContext(agentContext, conv.projectId);
    messages.push({ role: "system", content: `# 当前上下文\n\n${contextText}` });
    
    // 3. 获取最后的 assistant 消息（messages 已按 createdAt asc 排序）
    const lastAssistantMsg = conv.messages
      .filter(m => m.role === "assistant")
      .at(-1);

    // 4. 重建对话消息
    for (const msg of conv.messages) {
      if (msg.role === "user") {
        messages.push({ role: "user", content: msg.content });
      } else if (msg.role === "assistant") {
        // 从数据库读取 tool_calls
        let toolCalls: EngineMessage["tool_calls"] = undefined;
        if (msg.toolCalls) {
          try {
            toolCalls = JSON.parse(msg.toolCalls);
          } catch (e) {
            console.warn("[loadConversationState] 解析 toolCalls 失败:", e);
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

    // 5. 修正消息顺序，确保符合 OpenAI API 要求
    // 每个包含 tool_calls 的 assistant 消息后面必须紧跟对应的 tool 消息
    const correctedMessages = ensureToolCallOrder(messages);

    // 6. 状态一致性检查和修复（异步，不阻塞返回）
    if (conv.status === "awaiting_approval" && !isAwaitingApproval(correctedMessages)) {
      console.warn("[loadConversationState] 状态不一致，修复: awaiting_approval -> active");
      db.update(conversation)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(conversation.id, conversationId))
        .catch(err => console.error("[loadConversationState] 修复状态失败:", err));
    }

    return {
      conversationId,
      projectContext: agentContext,
      messages: correctedMessages,
      assistantMessageId: lastAssistantMsg?.id,
    };
  } catch (error) {
    console.error("[loadConversationState] 加载失败:", error);
    return null;
  }
}

