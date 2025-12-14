"use server";

import db from "@/lib/db";
import { character } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { 
  requireAuthAndProject, 
  revalidateCharactersPage,
  withErrorHandling 
} from "@/lib/actions/utils";

/**
 * 创建或更新角色 (Upsert)
 * 只处理文字设定，不处理图片
 */
export async function upsertCharacter(
  projectId: string,
  data: {
    id?: string;
    name: string;
    description?: string;
    appearance?: string;
  }
) {
  return withErrorHandling(async () => {
    // 验证登录和项目权限
    await requireAuthAndProject(projectId);

    if (data.id) {
      // 更新
      await db
        .update(character)
        .set({
          name: data.name,
          description: data.description,
          appearance: data.appearance,
        })
        .where(eq(character.id, data.id));
    } else {
      // 创建
      await db.insert(character).values({
        id: randomUUID(),
        projectId,
        name: data.name,
        description: data.description,
        appearance: data.appearance,
      });
    }

    revalidateCharactersPage(projectId);
    return { success: true };
  }, "保存角色失败");
}

/**
 * 删除角色
 */
export async function deleteCharacter(projectId: string, characterId: string) {
  return withErrorHandling(async () => {
    // 验证登录和项目权限
    await requireAuthAndProject(projectId);

    await db.delete(character).where(eq(character.id, characterId));

    revalidateCharactersPage(projectId);
    return { success: true };
  }, "删除角色失败");
}
