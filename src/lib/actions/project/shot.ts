"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { episode, shot, shotCharacter, shotDialogue } from "@/lib/db/schemas/project";
import { eq, asc } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  type NewShot,
  type ShotDetail,
  type ShotSize,
  type CameraMovement,
  type NewShotCharacter,
  type NewShotDialogue,
  type CharacterPosition,
  type EmotionTag,
  type ExtractedShot,
} from "@/types/project";

/**
 * 获取某剧集的所有分镜（按order排序）
 * 直接查询数据库，依赖客户端刷新机制
 */
export async function getEpisodeShots(
  episodeId: string,
): Promise<ShotDetail[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const shots = await db.query.shot.findMany({
      where: eq(shot.episodeId, episodeId),
      orderBy: [asc(shot.order)],
      with: {
        scene: true,
        shotCharacters: {
          orderBy: (shotCharacter, { asc }) => [asc(shotCharacter.order)],
          with: {
            character: true,
            characterImage: true,
          },
        },
        dialogues: {
          orderBy: (shotDialogue, { asc }) => [asc(shotDialogue.order)],
          with: {
            character: true,
          },
        },
      },
    });

    return shots as ShotDetail[];
  } catch (error) {
    console.error("获取分镜列表失败:", error);
    return [];
  }
}

/**
 * 创建新分镜
 */
export async function createShot(data: {
  episodeId: string;
  order: number;
  shotSize: ShotSize;
  cameraMovement?: CameraMovement;
  duration?: number;
  visualDescription?: string;
  visualPrompt?: string;
  audioPrompt?: string;
  sceneId?: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证剧集存在
    const episodeData = await db.query.episode.findFirst({
      where: eq(episode.id, data.episodeId),
    });

    if (!episodeData) {
      throw new Error("剧集不存在");
    }

    const newShot: NewShot = {
      id: randomUUID(),
      episodeId: data.episodeId,
      order: data.order,
      shotSize: data.shotSize,
      cameraMovement: data.cameraMovement || "static",
      duration: data.duration || 3000,
      visualDescription: data.visualDescription || null,
      visualPrompt: data.visualPrompt || null,
      audioPrompt: data.audioPrompt || null,
      sceneId: data.sceneId || null,
      imageUrl: null,
      videoUrl: null,
      finalAudioUrl: null,
    };

    const [created] = await db.insert(shot).values(newShot).returning();

    return { success: true, data: created };
  } catch (error) {
    console.error("创建分镜失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建失败",
    };
  }
}

/**
 * 更新分镜信息
 */
export async function updateShot(shotId: string, data: Partial<NewShot>) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const [updated] = await db
      .update(shot)
      .set(data)
      .where(eq(shot.id, shotId))
      .returning();

    // 获取剧集信息以便刷新路径
    const episodeData = await db.query.episode.findFirst({
      where: eq(episode.id, updated.episodeId),
    });

    if (episodeData) {
(`/projects/${episodeData.projectId}/editor`);
    }

    return { success: true, data: updated };
  } catch (error) {
    console.error("更新分镜失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新失败",
    };
  }
}

/**
 * 删除分镜并重新整理所有分镜编号
 */
export async function deleteShot(shotId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, shotId),
    });

    if (!shotData) {
      throw new Error("分镜不存在");
    }

    // 使用事务确保原子性
    await db.transaction(async (tx) => {
      // 1. 删除指定分镜
      await tx.delete(shot).where(eq(shot.id, shotId));

      // 2. 获取该剧集的所有剩余分镜（按 order 排序）
      const remainingShots = await tx.query.shot.findMany({
        where: eq(shot.episodeId, shotData.episodeId),
        orderBy: [asc(shot.order)],
      });

      // 3. 批量重新编号：将所有分镜的 order 重置为连续的 1, 2, 3...
      // 这样可以处理历史数据编号不连续的情况
      const updates = remainingShots.map((s, index) => {
        const newOrder = index + 1;
        if (s.order !== newOrder) {
          return tx
            .update(shot)
            .set({ order: newOrder })
            .where(eq(shot.id, s.id));
        }
        return null;
      }).filter(Boolean);

      // 4. 执行所有更新操作
      if (updates.length > 0) {
        await Promise.all(updates);
      }
    });



    return { success: true };
  } catch (error) {
    console.error("删除分镜失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    };
  }
}

/**
 * 批量更新分镜顺序
 */
export async function reorderShots(
  episodeId: string,
  shotOrders: { id: string; order: number }[],
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 批量更新每个分镜的order
    for (const shotOrder of shotOrders) {
      await db
        .update(shot)
        .set({ order: shotOrder.order })
        .where(eq(shot.id, shotOrder.id));
    }


    return { success: true };
  } catch (error) {
    console.error("重新排序分镜失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "重新排序失败",
    };
  }
}

// ==================== 角色管理 Actions ====================

/**
 * 添加角色到镜头
 */
export async function addCharacterToShot(data: {
  shotId: string;
  characterId: string;
  characterImageId?: string;
  position?: CharacterPosition;
  order?: number;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 获取当前镜头的最大order
    const existingCharacters = await db.query.shotCharacter.findMany({
      where: eq(shotCharacter.shotId, data.shotId),
    });

    const maxOrder = existingCharacters.length > 0 
      ? Math.max(...existingCharacters.map(sc => sc.order)) 
      : 0;

    const newShotCharacter: NewShotCharacter = {
      id: randomUUID(),
      shotId: data.shotId,
      characterId: data.characterId,
      characterImageId: data.characterImageId || null,
      position: data.position || null,
      order: data.order !== undefined ? data.order : maxOrder + 1,
    };

    const [created] = await db.insert(shotCharacter).values(newShotCharacter).returning();



    return { success: true, data: created };
  } catch (error) {
    console.error("添加角色失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "添加角色失败",
    };
  }
}

/**
 * 从镜头移除角色
 */
export async function removeCharacterFromShot(shotCharacterId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const shotCharacterData = await db.query.shotCharacter.findFirst({
      where: eq(shotCharacter.id, shotCharacterId),
    });

    if (!shotCharacterData) {
      throw new Error("角色关联不存在");
    }

    await db.delete(shotCharacter).where(eq(shotCharacter.id, shotCharacterId));

    return { success: true };
  } catch (error) {
    console.error("移除角色失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "移除角色失败",
    };
  }
}

/**
 * 更新镜头中的角色信息
 */
export async function updateShotCharacter(
  shotCharacterId: string,
  data: Partial<NewShotCharacter>
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const [updated] = await db
      .update(shotCharacter)
      .set(data)
      .where(eq(shotCharacter.id, shotCharacterId))
      .returning();

    return { success: true, data: updated };
  } catch (error) {
    console.error("更新角色信息失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新失败",
    };
  }
}

// ==================== 对话管理 Actions ====================

/**
 * 添加对话到镜头
 */
export async function addDialogueToShot(data: {
  shotId: string;
  characterId?: string;
  dialogueText: string;
  order?: number;
  emotionTag?: EmotionTag;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 获取当前镜头的最大order
    const existingDialogues = await db.query.shotDialogue.findMany({
      where: eq(shotDialogue.shotId, data.shotId),
    });

    const maxOrder = existingDialogues.length > 0
      ? Math.max(...existingDialogues.map(sd => sd.order))
      : 0;

    const newDialogue: NewShotDialogue = {
      id: randomUUID(),
      shotId: data.shotId,
      characterId: data.characterId || null,
      dialogueText: data.dialogueText,
      order: data.order !== undefined ? data.order : maxOrder + 1,
      emotionTag: data.emotionTag || null,
      startTime: null,
      duration: null,
      audioUrl: null,
    };

    const [created] = await db.insert(shotDialogue).values(newDialogue).returning();



    return { success: true, data: created };
  } catch (error) {
    console.error("添加对话失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "添加对话失败",
    };
  }
}

/**
 * 更新对话
 */
export async function updateShotDialogue(
  dialogueId: string,
  data: Partial<NewShotDialogue>
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const [updated] = await db
      .update(shotDialogue)
      .set(data)
      .where(eq(shotDialogue.id, dialogueId))
      .returning();



    return { success: true, data: updated };
  } catch (error) {
    console.error("更新对话失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新对话失败",
    };
  }
}

/**
 * 删除对话
 */
export async function deleteShotDialogue(dialogueId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    const dialogueData = await db.query.shotDialogue.findFirst({
      where: eq(shotDialogue.id, dialogueId),
    });

    if (!dialogueData) {
      throw new Error("对话不存在");
    }

    await db.delete(shotDialogue).where(eq(shotDialogue.id, dialogueId));



    return { success: true };
  } catch (error) {
    console.error("删除对话失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除对话失败",
    };
  }
}

/**
 * 重排对话顺序
 */
export async function reorderShotDialogues(
  shotId: string,
  dialogueOrders: { id: string; order: number }[]
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 批量更新每个对话的order
    for (const dialogueOrder of dialogueOrders) {
      await db
        .update(shotDialogue)
        .set({ order: dialogueOrder.order })
        .where(eq(shotDialogue.id, dialogueOrder.id));
    }

    return { success: true };
  } catch (error) {
    console.error("重新排序对话失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "重新排序失败",
    };
  }
}

// ==================== 分镜提取导入 Actions ====================

/**
 * 批量导入AI提取的分镜数据
 * 包括分镜基础信息、角色关联和对话
 */
export async function importExtractedShots(
  episodeId: string,
  extractedShots: ExtractedShot[]
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证剧集存在
    const episodeData = await db.query.episode.findFirst({
      where: eq(episode.id, episodeId),
    });

    if (!episodeData) {
      throw new Error("剧集不存在");
    }

    // 使用事务批量插入
    const result = await db.transaction(async (tx) => {
      const insertedShots: string[] = [];
      let totalCharacters = 0;
      let totalDialogues = 0;

      for (const extractedShot of extractedShots) {
        // 1. 创建分镜记录
        const shotId = randomUUID();
        const newShot: NewShot = {
          id: shotId,
          episodeId,
          order: extractedShot.order,
          shotSize: extractedShot.shotSize,
          cameraMovement: extractedShot.cameraMovement,
          duration: extractedShot.duration,
          visualDescription: extractedShot.visualDescription || null,
          visualPrompt: extractedShot.visualPrompt || null,
          audioPrompt: extractedShot.audioPrompt || null,
          sceneId: extractedShot.sceneId || null,
          imageUrl: null,
          videoUrl: null,
          finalAudioUrl: null,
        };

        await tx.insert(shot).values(newShot);
        insertedShots.push(shotId);

        // 2. 创建角色关联记录
        if (extractedShot.characters && extractedShot.characters.length > 0) {
          for (let i = 0; i < extractedShot.characters.length; i++) {
            const char = extractedShot.characters[i];
            
            // 只有当角色匹配成功时才创建关联
            if (char.characterId) {
              const newShotChar: NewShotCharacter = {
                id: randomUUID(),
                shotId,
                characterId: char.characterId,
                characterImageId: char.characterImageId || null,
                position: (char.position as CharacterPosition) || null,
                order: i + 1,
              };

              await tx.insert(shotCharacter).values(newShotChar);
              totalCharacters++;
            }
          }
        }

        // 3. 创建对话记录
        if (extractedShot.dialogues && extractedShot.dialogues.length > 0) {
          for (const dialogue of extractedShot.dialogues) {
            const newDialogue: NewShotDialogue = {
              id: randomUUID(),
              shotId,
              characterId: dialogue.characterId || null,
              dialogueText: dialogue.dialogueText,
              order: dialogue.order,
              emotionTag: (dialogue.emotionTag as EmotionTag) || null,
              startTime: null,
              duration: null,
              audioUrl: null,
            };

            await tx.insert(shotDialogue).values(newDialogue);
            totalDialogues++;
          }
        }
      }

      return {
        insertedShots,
        totalCharacters,
        totalDialogues,
      };
    });


    return {
      success: true,
      imported: {
        newShots: result.insertedShots.length,
        newCharacterLinks: result.totalCharacters,
        newDialogues: result.totalDialogues,
      },
    };
  } catch (error) {
    console.error("导入分镜失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "导入失败",
    };
  }
}

/**
 * 生成单个分镜图片
 */
export async function generateShotImage(shotId: string): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 获取分镜信息以验证权限
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, shotId),
      with: {
        episode: true,
      },
    });

    if (!shotData) {
      return { success: false, error: "分镜不存在" };
    }

    // 创建图片生成任务
    const { createJob } = await import("@/lib/actions/job");
    const episodeData = Array.isArray(shotData.episode) ? shotData.episode[0] : shotData.episode;
    if (!episodeData) {
      return { success: false, error: "无法获取剧集信息" };
    }
    const result = await createJob({
      userId: session.user.id,
      projectId: episodeData.projectId,
      type: "shot_image_generation",
      inputData: {
        shotId,
        regenerate: false,
      },
    });

    if (!result.success || !result.jobId) {
      return {
        success: false,
        error: result.error || "创建任务失败",
      };
    }

    return {
      success: true,
      jobId: result.jobId,
    };
  } catch (error) {
    console.error("生成分镜图片失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "生成失败",
    };
  }
}

/**
 * 批量生成分镜图片
 */
export async function batchGenerateShotImages(shotIds: string[]): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  if (!shotIds || shotIds.length === 0) {
    return { success: false, error: "未选择分镜" };
  }

  try {
    // 获取第一个分镜信息以获取项目ID
    const firstShot = await db.query.shot.findFirst({
      where: eq(shot.id, shotIds[0]),
      with: {
        episode: true,
      },
    });

    if (!firstShot) {
      return { success: false, error: "分镜不存在" };
    }

    // 创建批量生成任务
    const { createJob } = await import("@/lib/actions/job");
    const episodeData = Array.isArray(firstShot.episode) ? firstShot.episode[0] : firstShot.episode;
    if (!episodeData) {
      return { success: false, error: "无法获取剧集信息" };
    }
    const result = await createJob({
      userId: session.user.id,
      projectId: episodeData.projectId,
      type: "batch_shot_image_generation",
      inputData: {
        shotIds,
      },
    });

    if (!result.success || !result.jobId) {
      return {
        success: false,
        error: result.error || "创建任务失败",
      };
    }

    return {
      success: true,
      jobId: result.jobId,
    };
  } catch (error) {
    console.error("批量生成分镜图片失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "生成失败",
    };
  }
}

/**
 * 更新分镜角色的造型
 */
export async function updateShotCharacterImage(
  shotCharacterId: string,
  characterImageId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证 shotCharacter 存在
    const shotCharData = await db.query.shotCharacter.findFirst({
      where: eq(shotCharacter.id, shotCharacterId),
      with: {
        shot: {
          with: {
            episode: true,
          },
        },
      },
    });

    if (!shotCharData) {
      return { success: false, error: "分镜角色不存在" };
    }

    // 更新造型关联
    await db
      .update(shotCharacter)
      .set({
        characterImageId,
      })
      .where(eq(shotCharacter.id, shotCharacterId));

    return { success: true };
  } catch (error) {
    console.error("更新分镜角色造型失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新失败",
    };
  }
}

/**
 * 复制其他分镜的图片到当前分镜
 */
export async function copyShotImage(
  shotId: string,
  sourceShotId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证目标分镜存在
    const targetShot = await db.query.shot.findFirst({
      where: eq(shot.id, shotId),
      with: {
        episode: true,
      },
    });

    if (!targetShot) {
      return { success: false, error: "分镜不存在" };
    }

    // 验证源分镜存在且有图片
    const sourceShot = await db.query.shot.findFirst({
      where: eq(shot.id, sourceShotId),
    });

    if (!sourceShot) {
      return { success: false, error: "源分镜不存在" };
    }

    if (!sourceShot.imageUrl) {
      return { success: false, error: "源分镜还没有图片" };
    }

    // 更新分镜，复制图片URL
    await db
      .update(shot)
      .set({
        imageUrl: sourceShot.imageUrl,
      })
      .where(eq(shot.id, shotId));

    return { success: true };
  } catch (error) {
    console.error("复制分镜图片失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "复制失败",
    };
  }
}
