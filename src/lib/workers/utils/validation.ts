"use server";

import db from "@/lib/db";
import { project } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";

/**
 * 输入验证限制
 */
export const INPUT_LIMITS = {
  MAX_CONTENT_LENGTH: 50000, // 小说内容最大 50,000 字符
};

/**
 * 验证项目所有权
 */
export async function verifyProjectOwnership(
  projectId: string,
  userId: string
): Promise<boolean> {
  try {
    const projectData = await db.query.project.findFirst({
      where: and(eq(project.id, projectId), eq(project.userId, userId)),
    });
    return !!projectData;
  } catch (error) {
    console.error("验证项目所有权失败:", error);
    return false;
  }
}

/**
 * 清理和验证文本内容，防止 Prompt Injection
 */
export function sanitizeTextInput(text: string, maxLength: number): string {
  if (!text) return "";
  
  // 移除潜在的危险字符和控制字符
  let sanitized = text
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // 移除控制字符
    .trim();
  
  // 限制长度
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}


