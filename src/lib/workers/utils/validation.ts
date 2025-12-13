"use server";

import db from "@/lib/db";
import { project, episode } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";

/**
 * 输入验证限制
 */
export const INPUT_LIMITS = {
  MAX_CONTENT_LENGTH: 50000, // 小说内容最大 50,000 字符
  MAX_EPISODES: 50, // 最多 50 集
  MIN_EPISODES: 1, // 最少 1 集
  MAX_EPISODE_IDS: 100, // 最多处理 100 个剧集
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

/**
 * 验证数组中的 ID 是否属于指定项目
 */
export async function verifyEpisodeOwnership(
  episodeIds: string[],
  projectId: string
): Promise<boolean> {
  try {
    const episodes = await db.query.episode.findMany({
      where: eq(episode.projectId, projectId),
    });
    
    const projectEpisodeIds = new Set(episodes.map((ep) => ep.id));
    return episodeIds.every((id) => projectEpisodeIds.has(id));
  } catch (error) {
    console.error("验证剧集所有权失败:", error);
    return false;
  }
}

