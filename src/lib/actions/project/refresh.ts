"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { shot, character, scene } from "@/lib/db/schemas/project";
import { eq, asc } from "drizzle-orm";
import type { ShotDetail, Character, Scene } from "@/types/project";

/**
 * 刷新单个 shot 数据
 */
export async function refreshShot(shotId: string): Promise<{
  success: boolean;
  shot?: ShotDetail;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, shotId),
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

    if (!shotData) {
      return { success: false, error: "分镜不存在" };
    }

    return {
      success: true,
      shot: shotData as ShotDetail,
    };
  } catch (error) {
    console.error("刷新分镜数据失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "刷新失败",
    };
  }
}

/**
 * 刷新单个角色数据
 */
export async function refreshCharacter(
  characterId: string,
  projectId: string
): Promise<{
  success: boolean;
  character?: Character;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const characterData = await db.query.character.findFirst({
      where: eq(character.id, characterId),
      with: {
        images: {
          orderBy: (image, { desc }) => [desc(image.createdAt)],
        },
      },
    });

    if (!characterData) {
      return { success: false, error: "角色不存在" };
    }

    // 验证角色属于该项目
    if (characterData.projectId !== projectId) {
      return { success: false, error: "无权限访问" };
    }

    return {
      success: true,
      character: characterData as Character,
    };
  } catch (error) {
    console.error("刷新角色数据失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "刷新失败",
    };
  }
}

/**
 * 刷新单个场景数据
 */
export async function refreshScene(
  sceneId: string,
  projectId: string
): Promise<{
  success: boolean;
  scene?: Scene;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const sceneData = await db.query.scene.findFirst({
      where: eq(scene.id, sceneId),
      with: {
        images: {
          orderBy: (image, { desc }) => [desc(image.createdAt)],
        },
      },
    });

    if (!sceneData) {
      return { success: false, error: "场景不存在" };
    }

    // 验证场景属于该项目
    if (sceneData.projectId !== projectId) {
      return { success: false, error: "无权限访问" };
    }

    return {
      success: true,
      scene: sceneData as Scene,
    };
  } catch (error) {
    console.error("刷新场景数据失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "刷新失败",
    };
  }
}

/**
 * 刷新剧集的所有 shots
 */
export async function refreshEpisodeShots(episodeId: string): Promise<{
  success: boolean;
  shots?: ShotDetail[];
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
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

    return {
      success: true,
      shots: shots as ShotDetail[],
    };
  } catch (error) {
    console.error("刷新剧集分镜数据失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "刷新失败",
    };
  }
}

/**
 * 刷新整个项目数据（从 base.ts 复用）
 */
export async function refreshProject(projectId: string) {
  const { getProjectDetail } = await import("./base");
  return getProjectDetail(projectId);
}

