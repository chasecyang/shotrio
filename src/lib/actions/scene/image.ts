"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { sceneImage, project } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { generateImage } from "@/lib/services/fal.service";
import { createJob } from "@/lib/actions/job";
import { uploadImageFromUrl } from "@/lib/actions/upload-actions";
import { ImageCategory } from "@/lib/storage";

/**
 * 生成场景图片 (调用 AI)
 * 返回生成的图片 URL 列表，不保存到数据库
 */
export async function generateSceneImages(
  prompt: string,
  aspectRatio: "1:1" | "9:16" | "16:9" = "16:9",
  count: number = 4
): Promise<{ success: boolean; images?: string[]; error?: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const result = await generateImage({
      prompt,
      num_images: count,
      aspect_ratio: aspectRatio,
    });

    return {
      success: true,
      images: result.images.map((img) => img.url),
    };
  } catch (error) {
    console.error("生成场景图片失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "生成图片失败",
    };
  }
}

/**
 * 为单个场景视角生成图片（异步任务版本）
 * 创建一个任务来生成图片，而不是同步生成
 */
export async function generateImageForSceneView(
  projectId: string,
  sceneId: string,
  imageId: string
): Promise<{ success: boolean; jobId?: string; error?: string }> {
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
    });

    if (!projectData) {
      return { success: false, error: "项目不存在或无权限" };
    }

    // 获取场景视角信息
    const imageRecord = await db.query.sceneImage.findFirst({
      where: eq(sceneImage.id, imageId),
      with: {
        scene: true,
      },
    });

    if (!imageRecord) {
      return { success: false, error: "场景视角不存在" };
    }

    if (imageRecord.scene.id !== sceneId) {
      return { success: false, error: "视角与场景不匹配" };
    }

    if (!imageRecord.imagePrompt) {
      return { success: false, error: "该视角没有生成描述，无法生成图片" };
    }

    // 创建图片生成任务
    const input = {
      sceneId,
      imageId,
      regenerate: false,
    };

    const result = await createJob({
      userId: session.user.id,
      projectId,
      type: "scene_image_generation" as any, // TODO: 添加到job type enum
      inputData: input,
      totalSteps: 1,
    });

    return {
      success: result.success,
      jobId: result.jobId,
      error: result.error,
    };
  } catch (error) {
    console.error("创建图片生成任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建任务失败",
    };
  }
}

/**
 * 重新生成场景视角图片（异步任务版本）
 */
export async function regenerateSceneViewImage(
  projectId: string,
  sceneId: string,
  imageId: string
): Promise<{ success: boolean; jobId?: string; error?: string }> {
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
    });

    if (!projectData) {
      return { success: false, error: "项目不存在或无权限" };
    }

    // 创建重新生成任务
    const input = {
      sceneId,
      imageId,
      regenerate: true,
    };

    const result = await createJob({
      userId: session.user.id,
      projectId,
      type: "scene_image_generation" as any, // TODO: 添加到job type enum
      inputData: input,
      totalSteps: 1,
    });

    return {
      success: result.success,
      jobId: result.jobId,
      error: result.error,
    };
  } catch (error) {
    console.error("创建图片重新生成任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建任务失败",
    };
  }
}

/**
 * 保存场景视角图片
 */
export async function saveSceneImage(
  projectId: string,
  sceneId: string,
  data: {
    label: string;
    imageUrl: string;
    imagePrompt: string;
    seed?: number;
    isPrimary?: boolean;
  }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证项目权限
    const projectData = await db.query.project.findFirst({
      where: and(
        eq(project.id, projectId),
        eq(project.userId, session.user.id)
      ),
    });

    if (!projectData) {
      throw new Error("项目不存在或无权限");
    }

    // 将临时图片URL上传到R2存储，获取永久URL
    let finalImageUrl = data.imageUrl;
    
    // 检查是否是外部URL（fal.ai等临时URL），如果是则需要上传到R2
    if (data.imageUrl.startsWith("http") && !data.imageUrl.includes(process.env.R2_PUBLIC_DOMAIN || "")) {
      console.log("检测到外部图片URL，开始上传到R2:", data.imageUrl);
      const uploadResult = await uploadImageFromUrl(
        data.imageUrl,
        ImageCategory.SCENES,
        session.user.id
      );

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || "上传图片到R2失败");
      }

      finalImageUrl = uploadResult.url;
      console.log("图片已上传到R2:", finalImageUrl);
    }

    // 如果设为 Primary，先把其他的 Primary 取消
    if (data.isPrimary) {
      await db
        .update(sceneImage)
        .set({ isPrimary: false })
        .where(eq(sceneImage.sceneId, sceneId));
    }

    await db.insert(sceneImage).values({
      id: randomUUID(),
      sceneId,
      label: data.label,
      imageUrl: finalImageUrl, // 使用R2的永久URL
      imagePrompt: data.imagePrompt,
      seed: data.seed,
      isPrimary: data.isPrimary || false,
    });

    revalidatePath(`/projects/${projectId}/scenes`);
    return { success: true };
  } catch (error) {
    console.error("保存场景视角图片失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "保存图片失败",
    };
  }
}

/**
 * 删除场景视角图片
 */
export async function deleteSceneImage(projectId: string, imageId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证项目权限
    const projectData = await db.query.project.findFirst({
      where: and(
        eq(project.id, projectId),
        eq(project.userId, session.user.id)
      ),
    });

    if (!projectData) {
      throw new Error("项目不存在或无权限");
    }

    await db.delete(sceneImage).where(eq(sceneImage.id, imageId));

    revalidatePath(`/projects/${projectId}/scenes`);
    return { success: true };
  } catch (error) {
    console.error("删除场景视角图片失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除图片失败",
    };
  }
}

/**
 * 设置主图
 */
export async function setScenePrimaryImage(
  projectId: string,
  sceneId: string,
  imageId: string
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  try {
    // 验证项目权限
    const projectData = await db.query.project.findFirst({
      where: and(
        eq(project.id, projectId),
        eq(project.userId, session.user.id)
      ),
    });

    if (!projectData) {
      throw new Error("项目不存在或无权限");
    }

    // 事务处理：先取消所有primary，再设置新的primary
    await db.transaction(async (tx) => {
      await tx
        .update(sceneImage)
        .set({ isPrimary: false })
        .where(eq(sceneImage.sceneId, sceneId));

      await tx
        .update(sceneImage)
        .set({ isPrimary: true })
        .where(eq(sceneImage.id, imageId));
    });

    revalidatePath(`/projects/${projectId}/scenes`);
    return { success: true };
  } catch (error) {
    console.error("设置主图失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "设置主图失败",
    };
  }
}
