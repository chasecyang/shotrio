"use server";

import db from "@/lib/db";
import { shot } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { buildVideoPrompt, getKlingDuration } from "@/lib/utils/motion-prompt";
import { createShotVideoGeneration } from "@/lib/actions/project/shot-video";
import type { KlingO1ReferenceToVideoInput } from "@/lib/services/fal.service";

/**
 * 生成单个分镜的视频
 */
export async function generateShotVideo(shotId: string): Promise<{
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
    // 获取分镜信息以验证权限和数据（需要关联素材）
    const shotData = await db.query.shot.findFirst({
      where: eq(shot.id, shotId),
      with: {
        episode: true,
        shotAssets: {
          with: {
            asset: true,
          },
          orderBy: (shotAsset, { asc }) => [asc(shotAsset.order)],
        },
      },
    });

    if (!shotData) {
      return { success: false, error: "分镜不存在" };
    }

    // 检查是否有关联的图片（取第一张素材）
    const firstAsset = shotData.shotAssets?.[0]?.asset;
    if (!firstAsset || !firstAsset.imageUrl) {
      return { success: false, error: "该分镜没有图片，请先生成图片" };
    }

    // 自动生成视频参数（包含画面描述）
    const videoPrompt = buildVideoPrompt({
      description: shotData.description || undefined,
      visualPrompt: shotData.visualPrompt || undefined,
      cameraMovement: shotData.cameraMovement,
    });

    const duration = getKlingDuration(shotData.duration || 3000);

    // 构建 Kling O1 配置
    const klingO1Config: KlingO1ReferenceToVideoInput = {
      prompt: videoPrompt,
      elements: [
        {
          frontal_image_url: firstAsset.imageUrl,
        },
      ],
      duration,
    };

    // 使用新架构创建视频生成任务
    const result = await createShotVideoGeneration({
      shotId,
      klingO1Config,
    });

    if (!result.success || !result.data?.jobId) {
      return {
        success: false,
        error: result.error || "创建任务失败",
      };
    }

    return {
      success: true,
      jobId: result.data.jobId,
    };
  } catch (error) {
    console.error("生成分镜视频失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "生成失败",
    };
  }
}

