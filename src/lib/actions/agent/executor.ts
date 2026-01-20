"use server";

/**
 * Agent Function 执行器（精简版路由层）
 *
 * 将 Function Call 路由到对应的 Handler
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { FunctionCall, FunctionExecutionResult } from "@/types/agent";
import db from "@/lib/db";
import { conversation } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { validateFunctionParameters } from "./validation";
import { getHandler, requiresUserId } from "./handlers";

/**
 * 执行单个 function call
 */
export async function executeFunction(
  functionCall: FunctionCall,
  conversationId: string
): Promise<FunctionExecutionResult> {
  // 1. 认证检查
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: "未登录",
    };
  }

  // 2. 获取 projectId
  const conv = await db.query.conversation.findFirst({
    where: eq(conversation.id, conversationId),
  });

  if (!conv || !conv.projectId) {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: "对话不存在或未关联项目",
    };
  }

  const projectId = conv.projectId;
  const { name, parameters } = functionCall;

  // 3. 统一参数校验
  const validationResult = await validateFunctionParameters(
    name,
    JSON.stringify(parameters)
  );

  if (!validationResult.valid) {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: `参数校验失败: ${validationResult.errors.join("; ")}`,
    };
  }

  // 4. 路由到对应处理器
  const handler = getHandler(name);

  if (!handler) {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: `未知的 function: ${name}`,
    };
  }

  try {
    // 根据处理器类型调用
    if (requiresUserId(name)) {
      return await handler(functionCall, projectId, session.user.id);
    } else {
      return await handler(functionCall, projectId, session.user.id);
    }
  } catch (error) {
    console.error(`执行 function ${name} 失败:`, error);
    return {
      functionCallId: functionCall.id,
      success: false,
      error: error instanceof Error ? error.message : "执行失败",
    };
  }
}
