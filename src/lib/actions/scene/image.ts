"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { sceneImage, scene, project } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { buildMasterLayoutPrompt, buildQuarterViewPrompt } from "@/lib/prompts/scene";
import type { SceneImageType } from "@/types/project";
import { createJob } from "@/lib/actions/job";
import type { SceneImageGenerationInput } from "@/types/job";

/**
 * 开始生成 Master Layout 全景布局图（后台任务）
 */
export async function startMasterLayoutGeneration(
  projectId: string,
  sceneId: string
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

    // 获取场景信息
    const sceneData = await db.query.scene.findFirst({
      where: eq(scene.id, sceneId),
    });

    if (!sceneData) {
      return { success: false, error: "场景不存在" };
    }

    if (!sceneData.description) {
      return { success: false, error: "请先添加场景描述" };
    }

    // 检查是否已存在 master_layout 记录
    let imageRecord = await db.query.sceneImage.findFirst({
      where: and(
        eq(sceneImage.sceneId, sceneId),
        eq(sceneImage.imageType, "master_layout")
      ),
    });

    // 如果不存在，创建一条记录
    if (!imageRecord) {
      const imageId = randomUUID();
      const imagePrompt = buildMasterLayoutPrompt(sceneData);

      await db.insert(sceneImage).values({
        id: imageId,
        sceneId,
        imageType: "master_layout",
        imagePrompt,
        imageUrl: null,
        seed: null,
      });

      imageRecord = { id: imageId, sceneId, imageType: "master_layout" as SceneImageType, imagePrompt, imageUrl: null, seed: null, createdAt: new Date(), updatedAt: new Date() };
    } else {
      // 更新 prompt（以防场景描述有更新）
      const imagePrompt = buildMasterLayoutPrompt(sceneData);
      await db
        .update(sceneImage)
        .set({ imagePrompt })
        .where(eq(sceneImage.id, imageRecord.id));
    }

    // 创建后台任务
    const input: SceneImageGenerationInput = {
      sceneId,
      imageId: imageRecord.id,
      regenerate: !!imageRecord.imageUrl, // 如果已有图片，则为重新生成
    };

    const jobResult = await createJob({
      userId: session.user.id,
      projectId,
      type: "scene_image_generation",
      inputData: input,
    });

    if (!jobResult.success) {
      return { success: false, error: jobResult.error };
    }

    return {
      success: true,
      jobId: jobResult.jobId,
    };
  } catch (error) {
    console.error("创建 Master Layout 生成任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建任务失败",
    };
  }
}

/**
 * 开始生成 45° Quarter View 叙事主力视角（后台任务）
 */
export async function startQuarterViewGeneration(
  projectId: string,
  sceneId: string
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

    // 获取场景信息
    const sceneData = await db.query.scene.findFirst({
      where: eq(scene.id, sceneId),
    });

    if (!sceneData) {
      return { success: false, error: "场景不存在" };
    }

    if (!sceneData.description) {
      return { success: false, error: "请先添加场景描述" };
    }

    // 检查是否已完成 master_layout
    const masterLayout = await db.query.sceneImage.findFirst({
      where: and(
        eq(sceneImage.sceneId, sceneId),
        eq(sceneImage.imageType, "master_layout")
      ),
    });

    if (!masterLayout || !masterLayout.imageUrl) {
      return { success: false, error: "请先完成全景布局图的生成" };
    }

    // 检查是否已存在 quarter_view 记录
    let imageRecord = await db.query.sceneImage.findFirst({
      where: and(
        eq(sceneImage.sceneId, sceneId),
        eq(sceneImage.imageType, "quarter_view")
      ),
    });

    // 如果不存在，创建一条记录
    if (!imageRecord) {
      const imageId = randomUUID();
      const imagePrompt = buildQuarterViewPrompt(sceneData);

      await db.insert(sceneImage).values({
        id: imageId,
        sceneId,
        imageType: "quarter_view",
        imagePrompt,
        imageUrl: null,
        seed: null,
      });

      imageRecord = { id: imageId, sceneId, imageType: "quarter_view" as SceneImageType, imagePrompt, imageUrl: null, seed: null, createdAt: new Date(), updatedAt: new Date() };
    } else {
      // 更新 prompt（以防场景描述有更新）
      const imagePrompt = buildQuarterViewPrompt(sceneData);
      await db
        .update(sceneImage)
        .set({ imagePrompt })
        .where(eq(sceneImage.id, imageRecord.id));
    }

    // 创建后台任务
    const input: SceneImageGenerationInput = {
      sceneId,
      imageId: imageRecord.id,
      regenerate: !!imageRecord.imageUrl, // 如果已有图片，则为重新生成
    };

    const jobResult = await createJob({
      userId: session.user.id,
      projectId,
      type: "scene_image_generation",
      inputData: input,
    });

    if (!jobResult.success) {
      return { success: false, error: jobResult.error };
    }

    return {
      success: true,
      jobId: jobResult.jobId,
    };
  } catch (error) {
    console.error("创建 Quarter View 生成任务失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建任务失败",
    };
  }
}

/**
 * 重新生成指定类型的场景图片（后台任务）
 */
export async function regenerateSceneImage(
  projectId: string,
  sceneId: string,
  imageType: SceneImageType
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  if (imageType === "master_layout") {
    return startMasterLayoutGeneration(projectId, sceneId);
  } else {
    return startQuarterViewGeneration(projectId, sceneId);
  }
}

/**
 * 删除场景图片
 */
export async function deleteSceneImage(projectId: string, imageId: string) {
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

    await db.delete(sceneImage).where(eq(sceneImage.id, imageId));

    revalidatePath(`/projects/${projectId}/editor`);
    return { success: true };
  } catch (error) {
    console.error("删除场景图片失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除图片失败",
    };
  }
}

/**
 * 获取场景的两张核心图片
 */
export async function getSceneImages(sceneId: string): Promise<{
  masterLayout?: typeof sceneImage.$inferSelect;
  quarterView?: typeof sceneImage.$inferSelect;
}> {
  const images = await db.query.sceneImage.findMany({
    where: eq(sceneImage.sceneId, sceneId),
  });

  return {
    masterLayout: images.find(img => img.imageType === "master_layout"),
    quarterView: images.find(img => img.imageType === "quarter_view"),
  };
}
