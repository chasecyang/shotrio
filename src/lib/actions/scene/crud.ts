"use server";

import db from "@/lib/db";
import { scene } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { 
  requireAuthAndProject, 
  revalidateEditorPage,
  withErrorHandling 
} from "@/lib/actions/utils";

/**
 * 创建或更新场景 (Upsert)
 * 只处理文字设定，不处理图片
 */
export async function upsertScene(
  projectId: string,
  data: {
    id?: string;
    name: string;
    description?: string;
  }
) {
  return withErrorHandling(async () => {
    // 验证登录和项目权限
    await requireAuthAndProject(projectId);

    if (data.id) {
      // 更新
      await db
        .update(scene)
        .set({
          name: data.name,
          description: data.description,
        })
        .where(eq(scene.id, data.id));
    } else {
      // 创建
      await db.insert(scene).values({
        id: randomUUID(),
        projectId,
        name: data.name,
        description: data.description,
      });
    }

    revalidateEditorPage(projectId);
    return { success: true };
  }, "保存场景失败");
}

/**
 * 删除场景
 */
export async function deleteScene(projectId: string, sceneId: string) {
  return withErrorHandling(async () => {
    // 验证登录和项目权限
    await requireAuthAndProject(projectId);

    await db.delete(scene).where(eq(scene.id, sceneId));

    revalidateEditorPage(projectId);
    return { success: true };
  }, "删除场景失败");
}
