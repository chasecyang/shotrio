"use server";

import { db } from "@/lib/db";
import { shot } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/auth-utils";

export async function generateShotVideo(shotId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "未登录" };
  }

  try {
    // 获取分镜信息
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, shotId),
      with: {
        episode: {
          with: {
            project: true,
          },
        },
      },
    });

    if (!shotData) {
      return { success: false, error: "分镜不存在" };
    }

    if (!shotData.imageUrl) {
      return { success: false, error: "该分镜没有图片，无法生成视频" };
    }

    // 检查权限
    if (shotData.episode.project.userId !== user.id) {
      return { success: false, error: "无权限操作" };
    }

    return {
      success: true,
      shot: {
        id: shotData.id,
        imageUrl: shotData.imageUrl,
        duration: shotData.duration,
        cameraMovement: shotData.cameraMovement,
        visualPrompt: shotData.visualPrompt,
      },
    };
  } catch (error) {
    console.error("生成视频失败:", error);
    return { success: false, error: "服务器错误" };
  }
}

export async function updateShotVideo(shotId: string, videoUrl: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证权限
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, shotId),
      with: {
        episode: {
          with: {
            project: true,
          },
        },
      },
    });

    if (!shotData) {
      return { success: false, error: "分镜不存在" };
    }

    if (shotData.episode.project.userId !== user.id) {
      return { success: false, error: "无权限操作" };
    }

    // 更新视频URL
    await db
      .update(shot)
      .set({
        videoUrl,
        updatedAt: new Date(),
      })
      .where(eq(shot.id, shotId));

    return { success: true };
  } catch (error) {
    console.error("更新视频URL失败:", error);
    return { success: false, error: "服务器错误" };
  }
}
