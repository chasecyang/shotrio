"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { artStyle } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

/**
 * 创建用户自定义风格
 */
export async function createUserArtStyle(data: {
  name: string;
  description?: string;
  prompt: string;
  tags?: string[];
}): Promise<{ success: boolean; styleId?: string; error?: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const styleId = randomUUID();
    
    await db.insert(artStyle).values({
      id: styleId,
      name: data.name,
      description: data.description || null,
      prompt: data.prompt,
      tags: data.tags || null,
      previewImage: null,
      userId: session.user.id,
      isPublic: false,
      usageCount: 0,
    });

    revalidatePath("/projects/[id]/settings", "page");
    
    return { success: true, styleId };
  } catch (error) {
    console.error("创建用户风格失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建风格失败",
    };
  }
}

/**
 * 更新用户自定义风格
 */
export async function updateUserArtStyle(
  styleId: string,
  data: {
    name?: string;
    description?: string;
    prompt?: string;
    tags?: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证权限
    const style = await db.query.artStyle.findFirst({
      where: eq(artStyle.id, styleId),
    });

    if (!style) {
      return { success: false, error: "风格不存在" };
    }

    if (style.userId !== session.user.id) {
      return { success: false, error: "无权限修改此风格" };
    }

    await db
      .update(artStyle)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(artStyle.id, styleId));

    revalidatePath("/projects/[id]/settings", "page");
    
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
 * 删除用户自定义风格
 */
export async function deleteUserArtStyle(
  styleId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    // 验证权限
    const style = await db.query.artStyle.findFirst({
      where: eq(artStyle.id, styleId),
    });

    if (!style) {
      return { success: false, error: "风格不存在" };
    }

    if (style.userId !== session.user.id) {
      return { success: false, error: "无权限删除此风格" };
    }

    await db.delete(artStyle).where(eq(artStyle.id, styleId));

    revalidatePath("/projects/[id]/settings", "page");
    
    return { success: true };
  } catch (error) {
    console.error("删除风格失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除风格失败",
    };
  }
}

