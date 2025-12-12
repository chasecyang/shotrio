"use server";

import { db } from "@/lib/db";
import { shot, episode } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/auth-utils";

export async function getEpisodeForExport(episodeId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "未登录" };
  }

  try {
    // 获取剧集信息和所有分镜
    const episodeData = await db.query.episode.findFirst({
      where: eq(episode.id, episodeId),
      with: {
        project: true,
        shots: {
          orderBy: (shots, { asc }) => [asc(shots.order)],
          with: {
            dialogues: {
              orderBy: (dialogues, { asc }) => [asc(dialogues.order)],
              with: {
                character: true,
              },
            },
          },
        },
      },
    });

    if (!episodeData) {
      return { success: false, error: "剧集不存在" };
    }

    // 检查权限
    if (episodeData.project.userId !== user.id) {
      return { success: false, error: "无权限操作" };
    }

    // 过滤出有视频的分镜
    const shotsWithVideo = episodeData.shots.filter((s) => s.videoUrl);

    if (shotsWithVideo.length === 0) {
      return { success: false, error: "该剧集没有已生成的视频" };
    }

    return {
      success: true,
      episode: {
        id: episodeData.id,
        title: episodeData.title,
        shots: shotsWithVideo,
      },
    };
  } catch (error) {
    console.error("获取剧集导出数据失败:", error);
    return { success: false, error: "服务器错误" };
  }
}
