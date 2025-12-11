"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { artStyle } from "@/lib/db/schemas/project";
import { eq, isNull, desc, asc } from "drizzle-orm";
import type { ArtStyle } from "@/types/art-style";

/**
 * 获取所有系统预设风格
 */
export async function getSystemArtStyles(): Promise<ArtStyle[]> {
  try {
    const styles = await db.query.artStyle.findMany({
      where: isNull(artStyle.userId),
      orderBy: [desc(artStyle.usageCount), asc(artStyle.createdAt)],
    });
    
    return styles as ArtStyle[];
  } catch (error) {
    console.error("获取系统风格失败:", error);
    return [];
  }
}

/**
 * 获取当前用户的自定义风格
 */
export async function getUserArtStyles(userId: string): Promise<ArtStyle[]> {
  try {
    const styles = await db.query.artStyle.findMany({
      where: eq(artStyle.userId, userId),
      orderBy: desc(artStyle.createdAt),
    });
    
    return styles as ArtStyle[];
  } catch (error) {
    console.error("获取用户风格失败:", error);
    return [];
  }
}

/**
 * 根据ID获取风格详情
 */
export async function getArtStyleById(
  styleId: string
): Promise<ArtStyle | null> {
  try {
    const style = await db.query.artStyle.findFirst({
      where: eq(artStyle.id, styleId),
    });
    
    return style as ArtStyle | null;
  } catch (error) {
    console.error("获取风格详情失败:", error);
    return null;
  }
}


