"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { characterImage, project } from "@/lib/db/schemas/project";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createJob } from "@/lib/actions/job";
import type { CharacterImageGenerationInput } from "@/types/job";
import { uploadImageFromUrl } from "@/lib/actions/upload-actions";
import { ImageCategory } from "@/lib/storage";
import { generateStylePromptFromDescription } from "./prompt-generation";

/**
 * 为单个造型生成图片（异步任务版本）
 * 创建一个任务来生成图片，而不是同步生成
 */
export async function generateImageForCharacterStyle(
  projectId: string,
  characterId: string,
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

    // 获取角色造型信息
    const imageRecord = await db.query.characterImage.findFirst({
      where: eq(characterImage.id, imageId),
      with: {
        character: true,
      },
    });

    if (!imageRecord) {
      return { success: false, error: "造型不存在" };
    }

    // 类型断言：character 是一个对象而不是数组
    const characterData = imageRecord.character as { id: string };
    if (characterData.id !== characterId) {
      return { success: false, error: "造型与角色不匹配" };
    }

    // 如果没有造型描述，自动生成
    if (!imageRecord.imagePrompt) {
      console.log(`造型 ${imageId} 没有描述，开始自动生成...`);
      
      // 使用造型名称作为简单描述来生成专业prompt
      const description = imageRecord.label || "default style";
      const generateResult = await generateStylePromptFromDescription(
        characterId,
        description
      );

      if (!generateResult.success || !generateResult.prompt) {
        return { 
          success: false, 
          error: `自动生成造型描述失败: ${generateResult.error || "未知错误"}` 
        };
      }

      // 保存生成的描述到数据库
      await db
        .update(characterImage)
        .set({ imagePrompt: generateResult.prompt })
        .where(eq(characterImage.id, imageId));

      console.log(`造型描述已自动生成并保存: ${generateResult.prompt.substring(0, 100)}...`);
    }

    // 创建图片生成任务
    const input: CharacterImageGenerationInput = {
      characterId,
      imageId,
      regenerate: false,
    };

    const result = await createJob({
      userId: session.user.id,
      projectId,
      type: "character_image_generation",
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
 * 重新生成造型图片（异步任务版本）
 */
export async function regenerateCharacterStyleImage(
  projectId: string,
  characterId: string,
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
    const input: CharacterImageGenerationInput = {
      characterId,
      imageId,
      regenerate: true,
    };

    const result = await createJob({
      userId: session.user.id,
      projectId,
      type: "character_image_generation",
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
 * 保存角色图片状态
 */
export async function saveCharacterImage(
  projectId: string,
  characterId: string,
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
        ImageCategory.CHARACTERS,
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
        .update(characterImage)
        .set({ isPrimary: false })
        .where(eq(characterImage.characterId, characterId));
    }

    await db.insert(characterImage).values({
      id: randomUUID(),
      characterId,
      label: data.label,
      imageUrl: finalImageUrl, // 使用R2的永久URL
      imagePrompt: data.imagePrompt,
      seed: data.seed,
      isPrimary: data.isPrimary || false,
    });

    return { success: true };
  } catch (error) {
    console.error("保存图片状态失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "保存图片状态失败",
    };
  }
}

/**
 * 删除角色图片状态
 */
export async function deleteCharacterImage(projectId: string, imageId: string) {
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

    await db.delete(characterImage).where(eq(characterImage.id, imageId));

    return { success: true };
  } catch (error) {
    console.error("删除图片状态失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除图片状态失败",
    };
  }
}

/**
 * 设置主图
 */
export async function setCharacterPrimaryImage(
  projectId: string,
  characterId: string,
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
        .update(characterImage)
        .set({ isPrimary: false })
        .where(eq(characterImage.characterId, characterId));

      await tx
        .update(characterImage)
        .set({ isPrimary: true })
        .where(eq(characterImage.id, imageId));
    });

    return { success: true };
  } catch (error) {
    console.error("设置主图失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "设置主图失败",
    };
  }
}
