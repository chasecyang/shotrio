"use server";

import db from "@/lib/db";
import { artStyle } from "@/lib/db/schemas/project";
import { eq, isNull, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { generateImagePro } from "@/lib/services/fal.service";
import { uploadImageFromUrl } from "@/lib/actions/upload-actions";
import { ImageCategory } from "@/lib/storage";
import { requireAdmin } from "@/lib/auth/auth-utils";
import type { ArtStyle } from "@/types/art-style";
import { INITIAL_ART_STYLES } from "@/lib/db/seeds/art-styles";

/**
 * 用于生成风格预览图的统一主体
 * 使用统一的主体可以让用户更清楚地对比不同风格之间的差异
 */
const UNIFIED_PREVIEW_SUBJECT = "a young woman with long flowing hair, beautiful portrait, detailed face, elegant pose";

/**
 * 初始化美术风格数据（仅管理员）
 */
export async function initializeArtStyles(): Promise<{
  success: boolean;
  created: number;
  skipped: number;
  error?: string;
}> {
  try {
    // 验证管理员权限
    await requireAdmin();

    let created = 0;
    let skipped = 0;

    for (const style of INITIAL_ART_STYLES) {
      try {
        // 检查是否已存在
        const existing = await db.query.artStyle.findFirst({
          where: eq(artStyle.id, style.id),
        });

        if (existing) {
          skipped++;
          continue;
        }

        // 插入新风格
        await db.insert(artStyle).values({
          ...style,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        created++;
      } catch (error) {
        console.error(`创建风格失败: ${style.name}`, error);
      }
    }

    revalidatePath("/admin/art-styles");

    return {
      success: true,
      created,
      skipped,
    };
  } catch (error) {
    console.error("初始化美术风格失败:", error);
    return {
      success: false,
      created: 0,
      skipped: 0,
      error: error instanceof Error ? error.message : "初始化失败",
    };
  }
}

/**
 * 获取所有风格（包括系统预设和用户自定义）- 仅管理员
 */
export async function getAllArtStyles(): Promise<ArtStyle[]> {
  try {
    // 验证管理员权限
    await requireAdmin();

    const styles = await db.query.artStyle.findMany({
      orderBy: [isNull(artStyle.userId), desc(artStyle.createdAt)],
    });
    
    return styles as ArtStyle[];
  } catch (error) {
    console.error("获取所有风格失败:", error);
    throw error;
  }
}

/**
 * 根据ID获取风格详情 - 仅管理员
 */
export async function getArtStyleById(styleId: string): Promise<ArtStyle | null> {
  try {
    // 验证管理员权限
    await requireAdmin();

    const style = await db.query.artStyle.findFirst({
      where: eq(artStyle.id, styleId),
    });
    
    return style as ArtStyle | null;
  } catch (error) {
    console.error("获取风格详情失败:", error);
    throw error;
  }
}

/**
 * 创建系统预设风格（仅管理员）
 */
export async function createSystemArtStyle(data: {
  name: string;
  nameEn?: string;
  description?: string;
  prompt: string;
  tags?: string[];
}): Promise<{ success: boolean; styleId?: string; error?: string }> {
  try {
    // 验证管理员权限
    await requireAdmin();

    const styleId = randomUUID();
    
    await db.insert(artStyle).values({
      id: styleId,
      name: data.name,
      nameEn: data.nameEn || null,
      description: data.description || null,
      prompt: data.prompt,
      tags: data.tags || null,
      previewImage: null,
      userId: null, // 系统预设
      isPublic: false,
      usageCount: 0,
    });

    revalidatePath("/admin/art-styles");
    
    return { success: true, styleId };
  } catch (error) {
    console.error("创建系统风格失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建风格失败",
    };
  }
}

/**
 * 更新风格（仅管理员）
 */
export async function updateArtStyleAdmin(
  styleId: string,
  data: {
    name?: string;
    nameEn?: string;
    description?: string;
    prompt?: string;
    tags?: string[];
    previewImage?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // 验证管理员权限
    await requireAdmin();

    await db
      .update(artStyle)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(artStyle.id, styleId));

    revalidatePath("/admin/art-styles");
    
    return { success: true };
  } catch (error) {
    console.error("更新风格失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新风格失败",
    };
  }
}

/**
 * 删除风格（仅管理员）
 */
export async function deleteArtStyleAdmin(
  styleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 验证管理员权限
    await requireAdmin();

    await db.delete(artStyle).where(eq(artStyle.id, styleId));

    revalidatePath("/admin/art-styles");
    
    return { success: true };
  } catch (error) {
    console.error("删除风格失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除风格失败",
    };
  }
}

/**
 * 生成风格预览图（仅管理员）
 */
export async function generateStylePreview(
  styleId: string
): Promise<{ success: boolean; previewImage?: string; error?: string }> {
  try {
    // 验证管理员权限
    const user = await requireAdmin();

    // 1. 获取风格信息
    const style = await getArtStyleById(styleId);
    
    if (!style) {
      return { success: false, error: "风格不存在" };
    }

    // 2. 使用该风格的prompt生成示例图
    // 使用统一的主体以便用户更清楚地看到不同风格之间的区别
    const samplePrompt = `${UNIFIED_PREVIEW_SUBJECT}, ${style.prompt}, masterpiece, high quality, professional artwork`;
    
    const result = await generateImagePro({
      prompt: samplePrompt,
      num_images: 1,
      aspect_ratio: "4:3",
      resolution: "2K",
      output_format: "png",
    });

    if (!result.images || result.images.length === 0) {
      return { success: false, error: "生成图片失败" };
    }

    // 3. 上传到R2
    const uploadResult = await uploadImageFromUrl(
      result.images[0].url,
      ImageCategory.OTHER, // 使用OTHER分类，或者添加ART_STYLES分类
      user.id
    );

    if (!uploadResult.success || !uploadResult.url) {
      return { success: false, error: "上传图片失败" };
    }

    // 4. 更新数据库
    await db
      .update(artStyle)
      .set({
        previewImage: uploadResult.url,
        updatedAt: new Date(),
      })
      .where(eq(artStyle.id, styleId));

    revalidatePath("/admin/art-styles");
    
    return { success: true, previewImage: uploadResult.url };
  } catch (error) {
    console.error("生成预览图失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "生成预览图失败",
    };
  }
}

/**
 * 批量生成风格预览图（仅管理员）
 */
export async function batchGenerateStylePreviews(
  styleIds: string[]
): Promise<{ 
  success: boolean; 
  successCount: number;
  failedCount: number;
  errors?: string[];
}> {
  try {
    // 验证管理员权限
    await requireAdmin();

    if (styleIds.length === 0) {
      return { success: false, successCount: 0, failedCount: 0, errors: ["未选择任何风格"] };
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // 顺序处理每个风格，避免并发过多导致的问题
    for (const styleId of styleIds) {
      try {
        const result = await generateStylePreview(styleId);
        if (result.success) {
          successCount++;
        } else {
          failedCount++;
          errors.push(`${styleId}: ${result.error || "未知错误"}`);
        }
      } catch (error) {
        failedCount++;
        errors.push(`${styleId}: ${error instanceof Error ? error.message : "生成失败"}`);
      }
    }

    revalidatePath("/admin/art-styles");

    return {
      success: successCount > 0,
      successCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error("批量生成预览图失败:", error);
    return {
      success: false,
      successCount: 0,
      failedCount: styleIds.length,
      errors: [error instanceof Error ? error.message : "批量生成失败"],
    };
  }
}

/**
 * 批量删除风格（仅管理员）
 */
export async function batchDeleteArtStyles(
  styleIds: string[]
): Promise<{ 
  success: boolean; 
  successCount: number;
  failedCount: number;
  errors?: string[];
}> {
  try {
    // 验证管理员权限
    await requireAdmin();

    if (styleIds.length === 0) {
      return { success: false, successCount: 0, failedCount: 0, errors: ["未选择任何风格"] };
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // 顺序处理每个风格
    for (const styleId of styleIds) {
      try {
        const result = await deleteArtStyleAdmin(styleId);
        if (result.success) {
          successCount++;
        } else {
          failedCount++;
          errors.push(`${styleId}: ${result.error || "未知错误"}`);
        }
      } catch (error) {
        failedCount++;
        errors.push(`${styleId}: ${error instanceof Error ? error.message : "删除失败"}`);
      }
    }

    revalidatePath("/admin/art-styles");

    return {
      success: successCount > 0,
      successCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error("批量删除风格失败:", error);
    return {
      success: false,
      successCount: 0,
      failedCount: styleIds.length,
      errors: [error instanceof Error ? error.message : "批量删除失败"],
    };
  }
}

