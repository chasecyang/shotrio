"use server";

/**
 * Conversation CRUD Actions
 * 
 * 管理 AI 助手对话的创建、读取、更新和删除
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { conversation, conversationMessage } from "@/lib/db/schemas/project";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { AgentMessage } from "@/types/agent";

/**
 * 创建新对话
 */
export async function createConversation(input: {
  projectId: string;
  title?: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "未登录",
    };
  }

  try {
    const conversationId = `conv_${nanoid()}`;
    const title = input.title || `对话 ${new Date().toLocaleString("zh-CN")}`;

    await db.insert(conversation).values({
      id: conversationId,
      projectId: input.projectId,
      userId: session.user.id,
      title,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    });

    return {
      success: true,
      conversationId,
    };
  } catch (error) {
    console.error("[Conversation] 创建对话失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建对话失败",
    };
  }
}

/**
 * 获取项目的所有对话列表
 */
export async function listConversations(projectId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "未登录",
    };
  }

  try {
    const conversations = await db.query.conversation.findMany({
      where: and(
        eq(conversation.projectId, projectId),
        eq(conversation.userId, session.user.id)
      ),
      orderBy: [desc(conversation.lastActivityAt)],
    });

    return {
      success: true,
      conversations,
    };
  } catch (error) {
    console.error("[Conversation] 获取对话列表失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取对话列表失败",
    };
  }
}

/**
 * 获取对话详情（包含所有消息）
 */
export async function getConversation(conversationId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "未登录",
    };
  }

  try {
    const conv = await db.query.conversation.findFirst({
      where: and(
        eq(conversation.id, conversationId),
        eq(conversation.userId, session.user.id)
      ),
      with: {
        messages: {
          orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        },
      },
    });

    if (!conv) {
      return {
        success: false,
        error: "对话不存在",
      };
    }

    // 转换消息格式
    const messages: AgentMessage[] = conv.messages.map((msg) => {
      const message: AgentMessage = {
        id: msg.id,
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
        timestamp: msg.createdAt,
        isStreaming: msg.isStreaming || false,
        isInterrupted: msg.isInterrupted || false,
      };

      if (msg.thinkingProcess) {
        message.thinkingProcess = msg.thinkingProcess;
      }

      if (msg.iterations) {
        try {
          message.iterations = JSON.parse(msg.iterations);
        } catch (e) {
          console.error("[Conversation] 解析 iterations 失败:", e);
        }
      }

      if (msg.pendingAction) {
        try {
          message.pendingAction = JSON.parse(msg.pendingAction);
        } catch (e) {
          console.error("[Conversation] 解析 pendingAction 失败:", e);
        }
      }

      return message;
    });

    return {
      success: true,
      conversation: {
        id: conv.id,
        projectId: conv.projectId,
        title: conv.title,
        status: conv.status,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        lastActivityAt: conv.lastActivityAt,
      },
      messages,
    };
  } catch (error) {
    console.error("[Conversation] 获取对话详情失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取对话详情失败",
    };
  }
}

/**
 * 更新对话状态
 */
export async function updateConversationStatus(
  conversationId: string,
  status: "active" | "awaiting_approval" | "completed"
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "未登录",
    };
  }

  try {
    await db
      .update(conversation)
      .set({
        status,
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      })
      .where(
        and(
          eq(conversation.id, conversationId),
          eq(conversation.userId, session.user.id)
        )
      );

    return {
      success: true,
    };
  } catch (error) {
    console.error("[Conversation] 更新对话状态失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新对话状态失败",
    };
  }
}

/**
 * 更新对话标题
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "未登录",
    };
  }

  try {
    await db
      .update(conversation)
      .set({
        title,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversation.id, conversationId),
          eq(conversation.userId, session.user.id)
        )
      );

    return {
      success: true,
    };
  } catch (error) {
    console.error("[Conversation] 更新对话标题失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新对话标题失败",
    };
  }
}

/**
 * 删除对话
 */
export async function deleteConversation(conversationId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "未登录",
    };
  }

  try {
    await db
      .delete(conversation)
      .where(
        and(
          eq(conversation.id, conversationId),
          eq(conversation.userId, session.user.id)
        )
      );

    return {
      success: true,
    };
  } catch (error) {
    console.error("[Conversation] 删除对话失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除对话失败",
    };
  }
}

/**
 * 保存消息到数据库
 */
export async function saveMessage(
  conversationId: string,
  message: Omit<AgentMessage, "id" | "timestamp">
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "未登录",
    };
  }

  try {
    const messageId = `msg_${nanoid()}`;

    await db.insert(conversationMessage).values({
      id: messageId,
      conversationId,
      role: message.role,
      content: message.content,
      thinkingProcess: message.thinkingProcess || null,
      iterations: message.iterations ? JSON.stringify(message.iterations) : null,
      pendingAction: message.pendingAction ? JSON.stringify(message.pendingAction) : null,
      isStreaming: message.isStreaming || false,
      isInterrupted: message.isInterrupted || false,
      createdAt: new Date(),
    });

    // 更新对话的最后活动时间
    await db
      .update(conversation)
      .set({
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversation.id, conversationId));

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    console.error("[Conversation] 保存消息失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "保存消息失败",
    };
  }
}

/**
 * 更新消息（用于流式更新）
 */
export async function updateMessage(
  messageId: string,
  updates: {
    content?: string;
    thinkingProcess?: string;
    iterations?: string; // JSON string
    pendingAction?: string | null; // JSON string or null to clear
    isStreaming?: boolean;
    isInterrupted?: boolean;
  }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "未登录",
    };
  }

  try {
    await db
      .update(conversationMessage)
      .set(updates)
      .where(eq(conversationMessage.id, messageId));

    return {
      success: true,
    };
  } catch (error) {
    console.error("[Conversation] 更新消息失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新消息失败",
    };
  }
}

/**
 * 根据消息ID获取单条消息
 */
export async function getMessageById(messageId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "未登录",
    };
  }

  try {
    const msg = await db.query.conversationMessage.findFirst({
      where: eq(conversationMessage.id, messageId),
    });

    if (!msg) {
      return {
        success: false,
        error: "消息不存在",
      };
    }

    // 转换消息格式
    const message: AgentMessage = {
      id: msg.id,
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
      timestamp: msg.createdAt,
      isStreaming: msg.isStreaming || false,
      isInterrupted: msg.isInterrupted || false,
    };

    if (msg.thinkingProcess) {
      message.thinkingProcess = msg.thinkingProcess;
    }

    if (msg.iterations) {
      try {
        message.iterations = JSON.parse(msg.iterations);
      } catch (e) {
        console.error("[Conversation] 解析 iterations 失败:", e);
      }
    }

    if (msg.pendingAction) {
      try {
        message.pendingAction = JSON.parse(msg.pendingAction);
      } catch (e) {
        console.error("[Conversation] 解析 pendingAction 失败:", e);
      }
    }

    return {
      success: true,
      message,
    };
  } catch (error) {
    console.error("[Conversation] 获取消息失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取消息失败",
    };
  }
}

