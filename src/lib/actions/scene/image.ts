"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { sceneImage, scene, project } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { generateImage } from "@/lib/services/fal.service";
import { uploadImageFromUrl } from "@/lib/actions/upload-actions";
import { ImageCategory } from "@/lib/storage";
import { buildMasterLayoutPrompt, buildQuarterViewPrompt } from "@/lib/prompts/scene";
import type { SceneImageType } from "@/types/project";

/**
 * 生成 Master Layout 全景布局图（4张候选）
 */
export async function generateMasterLayout(
  projectId: string,
  sceneId: string
): Promise<{ success: boolean; images?: string[]; error?: string }> {
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

    // 构建 prompt
    const prompt = buildMasterLayoutPrompt(sceneData);

    // 生成图片
    const result = await generateImage({
      prompt,
      num_images: 4,
      aspect_ratio: "16:9",
      resolution: "2K",
      output_format: "png",
    });

    return {
      success: true,
      images: result.images.map((img) => img.url),
    };
  } catch (error) {
    console.error("生成 Master Layout 失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "生成图片失败",
    };
  }
}

/**
 * 生成 45° Quarter View 叙事主力视角（4张候选）
 */
export async function generateQuarterView(
  projectId: string,
  sceneId: string
): Promise<{ success: boolean; images?: string[]; error?: string }> {
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

    // 构建 prompt
    const prompt = buildQuarterViewPrompt(sceneData);

    // 生成图片
    const result = await generateImage({
      prompt,
      num_images: 4,
      aspect_ratio: "16:9",
      resolution: "2K",
      output_format: "png",
    });

    return {
      success: true,
      images: result.images.map((img) => img.url),
    };
  } catch (error) {
    console.error("生成 Quarter View 失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "生成图片失败",
    };
  }
}

/**
 * 保存 Master Layout 图片
 */
export async function saveMasterLayout(
  projectId: string,
  sceneId: string,
  imageUrl: string
): Promise<{ success: boolean; error?: string }> {
  return saveSceneImage(projectId, sceneId, "master_layout", imageUrl);
}

/**
 * 保存 45° Quarter View 图片
 */
export async function saveQuarterView(
  projectId: string,
  sceneId: string,
  imageUrl: string
): Promise<{ success: boolean; error?: string }> {
  return saveSceneImage(projectId, sceneId, "quarter_view", imageUrl);
}

/**
 * 通用的保存场景图片函数
 */
async function saveSceneImage(
  projectId: string,
  sceneId: string,
  imageType: SceneImageType,
  imageUrl: string
): Promise<{ success: boolean; error?: string }> {
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

    // 获取场景信息用于构建 prompt
    const sceneData = await db.query.scene.findFirst({
      where: eq(scene.id, sceneId),
    });

    if (!sceneData) {
      return { success: false, error: "场景不存在" };
    }

    // 将临时图片URL上传到R2存储，获取永久URL
    let finalImageUrl = imageUrl;
    
    // 检查是否是外部URL（fal.ai等临时URL），如果是则需要上传到R2
    if (imageUrl.startsWith("http") && !imageUrl.includes(process.env.R2_PUBLIC_DOMAIN || "")) {
      console.log("检测到外部图片URL，开始上传到R2:", imageUrl);
      const uploadResult = await uploadImageFromUrl(
        imageUrl,
        ImageCategory.SCENES,
        session.user.id
      );

      if (!uploadResult.success || !uploadResult.url) {
        return { success: false, error: uploadResult.error || "上传图片到R2失败" };
      }

      finalImageUrl = uploadResult.url;
      console.log("图片已上传到R2:", finalImageUrl);
    }

    // 构建完整的 prompt（用于记录）
    const imagePrompt = imageType === "master_layout" 
      ? buildMasterLayoutPrompt(sceneData)
      : buildQuarterViewPrompt(sceneData);

    // 检查是否已存在该类型的图片，如果存在则更新，否则插入
    const existingImage = await db.query.sceneImage.findFirst({
      where: and(
        eq(sceneImage.sceneId, sceneId),
        eq(sceneImage.imageType, imageType)
      ),
    });

    if (existingImage) {
      // 更新现有图片
      await db
        .update(sceneImage)
        .set({
          imageUrl: finalImageUrl,
          imagePrompt,
        })
        .where(eq(sceneImage.id, existingImage.id));
    } else {
      // 插入新图片
      await db.insert(sceneImage).values({
        id: randomUUID(),
        sceneId,
        imageType,
        imageUrl: finalImageUrl,
        imagePrompt,
      });
    }

    revalidatePath(`/projects/${projectId}/scenes`);
    return { success: true };
  } catch (error) {
    console.error("保存场景图片失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "保存图片失败",
    };
  }
}

/**
 * 重新生成指定类型的场景图片
 */
export async function regenerateSceneImage(
  projectId: string,
  sceneId: string,
  imageType: SceneImageType
): Promise<{ success: boolean; images?: string[]; error?: string }> {
  if (imageType === "master_layout") {
    return generateMasterLayout(projectId, sceneId);
  } else {
    return generateQuarterView(projectId, sceneId);
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

    revalidatePath(`/projects/${projectId}/scenes`);
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
