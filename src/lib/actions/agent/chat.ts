"use server";

/**
 * Agent Action Handlers
 * 
 * 处理需要确认的操作的执行和取消
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type {
  AgentChatResponse,
  FunctionCall,
} from "@/types/agent";
import { executeFunction } from "./executor";
import { updateMessage, updateConversationStatus, getMessageById } from "../conversation/crud";

/**
 * 确认并执行待处理的操作
 */
export async function confirmAndExecuteAction(input: {
  conversationId: string;
  messageId: string;
  functionCalls: FunctionCall[];
}): Promise<AgentChatResponse> {
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
    // 1. 读取当前消息和 pendingAction
    const messageResult = await getMessageById(input.messageId);
    if (!messageResult.success || !messageResult.message?.pendingAction) {
      return {
        success: false,
        error: "找不到待确认的操作",
      };
    }

    const pendingAction = messageResult.message.pendingAction;
    
    // 2. 检查是否已经被处理
    if (pendingAction.status === "accepted") {
      return {
        success: false,
        error: "该操作已被接受",
      };
    }
    
    if (pendingAction.status === "rejected") {
      return {
        success: false,
        error: "该操作已被拒绝",
      };
    }

    // 3. 执行所有 function calls
    const results = [];
    
    for (const functionCall of input.functionCalls) {
      console.log("[Agent] 执行确认的操作:", functionCall.name);
      const result = await executeFunction(functionCall);
      results.push(result);

      // 如果有失败，停止后续执行
      if (!result.success) {
        break;
      }
    }

    // 4. 构建反馈消息
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    let message = "";
    if (failCount === 0) {
      message = `✅ 已成功执行 ${successCount} 个操作`;
      
      const jobIds = results.filter((r) => r.jobId).map((r) => r.jobId);
      if (jobIds.length > 0) {
        message += `，已创建 ${jobIds.length} 个后台任务`;
      }
    } else {
      message = `⚠️ 执行完成：${successCount} 个成功，${failCount} 个失败`;
    }

    // 5. 清空 pendingAction（已处理完成）
    await updateMessage(input.messageId, {
      pendingAction: null,
    });

    // 6. 更新对话状态为 active
    await updateConversationStatus(input.conversationId, "active");

    return {
      success: true,
      message,
      executedResults: results,
    };
  } catch (error) {
    console.error("[Agent] 执行操作失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "执行失败",
    };
  }
}

/**
 * 拒绝操作并让 Agent 继续执行
 */
export async function rejectAndContinueAction(input: {
  conversationId: string;
  messageId: string;
  rejectionReason?: string;
}): Promise<AgentChatResponse> {
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
    // 1. 读取当前消息和 pendingAction
    const messageResult = await getMessageById(input.messageId);
    if (!messageResult.success || !messageResult.message?.pendingAction) {
      return {
        success: false,
        error: "找不到待确认的操作",
      };
    }

    const pendingAction = messageResult.message.pendingAction;
    
    // 2. 检查是否已经被处理
    if (pendingAction.status === "rejected") {
      return {
        success: false,
        error: "该操作已被拒绝",
      };
    }
    
    if (pendingAction.status === "accepted") {
      return {
        success: false,
        error: "该操作已被接受",
      };
    }
    
    // 3. 更新 pendingAction 状态为 rejected（但保留数据用于 resume-stream）
    await updateMessage(input.messageId, {
      pendingAction: JSON.stringify({
        ...pendingAction,
        status: "rejected",
        rejectedAt: new Date().toISOString(),
        rejectionReason: input.rejectionReason,
      }),
    });

    // 4. 更新对话状态为 active（准备继续）
    await updateConversationStatus(input.conversationId, "active");

    console.log("[Agent] 用户拒绝操作，准备继续执行");

    return {
      success: true,
      message: "操作已拒绝，Agent 将继续提供替代方案",
    };
  } catch (error) {
    console.error("[Agent] 拒绝操作失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "拒绝操作失败",
    };
  }
}
