"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { scene, project } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import type { ExtractedScene } from "@/types/project";

/**
 * 批量导入提取的场景
 * 智能合并：已存在的场景跳过，不存在的场景新建
 */
export async function importExtractedScenes(
  projectId: string,
  scenes: ExtractedScene[]
): Promise<{ 
  success: boolean; 
  imported?: { newScenes: number; skippedScenes: number }; 
  error?: string 
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证项目权限
    const projectData = await db.query.project.findFirst({
      where: and(
        eq(project.id, projectId),
        eq(project.userId, session.user.id)
      ),
      with: {
        scenes: true,
      },
    });

    if (!projectData) {
      return { success: false, error: "项目不存在或无权限" };
    }

    // 统计信息
    let newScenesCount = 0;
    let skippedScenesCount = 0;

    // 使用事务处理批量导入
    await db.transaction(async (tx) => {
      for (const extractedScene of scenes) {
        // 查找是否已存在同名场景（模糊匹配）
        const existingScene = projectData.scenes?.find(
          s => s.name.toLowerCase().trim() === extractedScene.name.toLowerCase().trim()
        );

        if (existingScene) {
          // 场景已存在，跳过
          skippedScenesCount++;
        } else {
          // 创建新场景
          const sceneId = randomUUID();
          await tx.insert(scene).values({
            id: sceneId,
            projectId,
            name: extractedScene.name,
            description: extractedScene.description,
          });

          newScenesCount++;
        }
      }
    });

    revalidatePath(`/projects/${projectId}/editor`);

    return {
      success: true,
      imported: {
        newScenes: newScenesCount,
        skippedScenes: skippedScenesCount,
      },
    };
  } catch (error) {
    console.error("导入场景失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "导入场景失败",
    };
  }
}

