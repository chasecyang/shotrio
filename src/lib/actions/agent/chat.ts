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

/**
 * 确认并执行待处理的操作
 */
export async function confirmAndExecuteAction(input: {
  actionId: string;
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
    // 执行所有 function calls
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

    // 构建反馈消息
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    let message = "";
    if (failCount === 0) {
      message = `✅ 已成功执行 ${successCount} 个操作`;
      
      // 如果有创建 Job，提示用户
      const jobIds = results.filter((r) => r.jobId).map((r) => r.jobId);
      if (jobIds.length > 0) {
        message += `，已创建 ${jobIds.length} 个后台任务`;
      }
    } else {
      message = `⚠️ 执行完成：${successCount} 个成功，${failCount} 个失败`;
    }

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
 * 取消待处理的操作
 */
export async function cancelAction(actionId: string): Promise<{ success: boolean }> {
  // 只是移除 pending action，无需其他操作
  return { success: true };
}

