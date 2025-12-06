"use server";

import db from "@/lib/db";
import { user } from "@/lib/db/schemas/auth";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getImageUrl } from "@/lib/storage/r2.service";

/**
 * 获取当前用户的完整信息
 */
export async function getCurrentUser() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return null;
    }

    const userData = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
    });

    if (userData && userData.image) {
      // 如果图片字段不包含 http，假设它是 R2 Key，获取公开 URL
      if (!userData.image.startsWith("http")) {
        const publicUrl = getImageUrl(userData.image);
        if (publicUrl) {
          userData.image = publicUrl;
        }
      }
    }

    return userData;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}
