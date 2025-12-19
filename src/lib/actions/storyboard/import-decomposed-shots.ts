"use server";

import db from "@/lib/db";
import { job, shot, shotDialogue } from "@/lib/db/schemas/project";
import { eq, gte, sql, and } from "drizzle-orm";
import { requireAuth } from "@/lib/actions/utils/auth";
import type { ShotDecompositionResult } from "@/types/job";
import { nanoid } from "nanoid";

/**
 * 导入拆解后的分镜
 * 1. 删除原分镜及其关联数据（对话、角色）
 * 2. 插入新的子分镜
 * 3. 调整后续分镜的order
 * 4. 标记任务为已导入
 */
export async function importDecomposedShots(params: {
  jobId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 验证用户登录
    const { userId } = await requireAuth();

    // 2. 获取任务信息
    const jobData = await db.query.job.findFirst({
      where: eq(job.id, params.jobId),
    });

    if (!jobData) {
      return {
        success: false,
        error: "任务不存在",
      };
    }

    // 3. 验证任务所有者
    if (jobData.userId !== userId) {
      return {
        success: false,
        error: "无权访问该任务",
      };
    }

    // 4. 验证任务类型和状态
    if (jobData.type !== "shot_decomposition") {
      return {
        success: false,
        error: "任务类型错误",
      };
    }

    if (jobData.status !== "completed") {
      return {
        success: false,
        error: "任务尚未完成",
      };
    }

    if (jobData.isImported) {
      return {
        success: false,
        error: "任务已导入，不能重复导入",
      };
    }

    // 5. 解析结果数据
    if (!jobData.resultData) {
      return {
        success: false,
        error: "任务结果为空",
      };
    }

    const result: ShotDecompositionResult = JSON.parse(jobData.resultData);

    if (!result.decomposedShots || result.decomposedShots.length === 0) {
      return {
        success: false,
        error: "拆解结果为空",
      };
    }

    // 6. 在数据库事务中执行导入
    await db.transaction(async (tx) => {
      // 6.1 获取原分镜信息
      const originalShot = await tx.query.shot.findFirst({
        where: eq(shot.id, result.originalShotId),
      });

      if (!originalShot) {
        throw new Error("原分镜不存在");
      }

      const originalOrder = originalShot.order;
      const episodeId = originalShot.episodeId;
      const decomposedCount = result.decomposedShots.length;

      // 6.2 调整后续分镜的order（需要为新分镜腾出空间）
      // 例如：原分镜order=5，拆成3个分镜，则需要将order>=6的分镜order+2
      const orderIncrement = decomposedCount - 1;

      if (orderIncrement > 0) {
        await tx
          .update(shot)
          .set({
            order: sql`${shot.order} + ${orderIncrement}`,
          })
          .where(
            and(
              eq(shot.episodeId, episodeId),
              gte(shot.order, originalOrder + 1)
            )
          );
      }

      // 6.3 删除原分镜（级联删除dialogues）
      await tx.delete(shot).where(eq(shot.id, result.originalShotId));

      // 6.4 插入新的子分镜
      for (let i = 0; i < result.decomposedShots.length; i++) {
        const subShot = result.decomposedShots[i];
        const newShotId = nanoid();
        const newOrder = originalOrder + i;

        // 插入分镜
        await tx.insert(shot).values({
          id: newShotId,
          episodeId,
          order: newOrder,
          shotSize: subShot.shotSize as typeof shot.$inferInsert.shotSize,
          cameraMovement: subShot.cameraMovement as typeof shot.$inferInsert.cameraMovement,
          duration: subShot.duration,
          visualDescription: subShot.visualDescription || null,
          visualPrompt: subShot.visualPrompt || null,
          audioPrompt: subShot.audioPrompt || null,
          // sceneId 已废弃 - 使用 asset tag 系统代替
        });

        // 角色信息现在通过 asset tag 系统管理，不再需要 shotCharacter 关联表

        // 插入对话
        for (const dlg of subShot.dialogues) {
          const speakerName = (dlg as { characterName?: string; dialogueText: string; emotionTag?: string; order: number }).characterName || 
                             (dlg as { characterId?: string; dialogueText: string; emotionTag?: string; order: number }).characterId || 
                             null;
          
          await tx.insert(shotDialogue).values({
            id: nanoid(),
            shotId: newShotId,
            speakerName: speakerName,
            dialogueText: dlg.dialogueText,
            emotionTag: dlg.emotionTag || null,
            order: dlg.order,
          });
        }
      }

      // 6.5 标记任务为已导入
      await tx
        .update(job)
        .set({
          isImported: true,
          updatedAt: new Date(),
        })
        .where(eq(job.id, params.jobId));
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("导入拆解结果失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "导入失败",
    };
  }
}

