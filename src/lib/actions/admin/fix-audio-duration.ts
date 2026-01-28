"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { audioData } from "@/lib/db/schemas/project";
import { eq, isNull, or } from "drizzle-orm";
import { getVideoDuration } from "@/lib/utils/video-thumbnail";

interface FixResult {
  success: boolean;
  fixed: number;
  failed: number;
  total: number;
  details: Array<{
    id: string;
    audioUrl: string;
    duration: number | null;
    error?: string;
  }>;
  error?: string;
}

interface ScanResult {
  success: boolean;
  fixableCount: number;
  unfixableCount: number;
  items: Array<{
    id: string;
    assetId: string;
    audioUrl: string | null;
  }>;
  error?: string;
}

/**
 * 查找所有没有 duration 的音频素材
 */
export async function findAudioWithoutDuration(): Promise<ScanResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      fixableCount: 0,
      unfixableCount: 0,
      items: [],
      error: "未登录",
    };
  }

  // 检查是否是管理员
  if (session.user.role !== "admin") {
    return {
      success: false,
      fixableCount: 0,
      unfixableCount: 0,
      items: [],
      error: "无权限",
    };
  }

  try {
    const items = await db.query.audioData.findMany({
      where: or(isNull(audioData.duration), eq(audioData.duration, 0)),
      columns: {
        id: true,
        assetId: true,
        audioUrl: true,
      },
    });

    // 区分可修复（有 audioUrl）和不可修复（没有 audioUrl，可能还在生成中）
    const fixableItems = items.filter((item) => item.audioUrl);
    const unfixableCount = items.length - fixableItems.length;

    return {
      success: true,
      fixableCount: fixableItems.length,
      unfixableCount,
      items: fixableItems,
    };
  } catch (error) {
    console.error("查询失败:", error);
    return {
      success: false,
      fixableCount: 0,
      unfixableCount: 0,
      items: [],
      error: error instanceof Error ? error.message : "查询失败",
    };
  }
}

/**
 * 批量修复音频时长
 */
export async function fixAudioDurations(): Promise<FixResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      fixed: 0,
      failed: 0,
      total: 0,
      details: [],
      error: "未登录",
    };
  }

  // 检查是否是管理员
  if (session.user.role !== "admin") {
    return {
      success: false,
      fixed: 0,
      failed: 0,
      total: 0,
      details: [],
      error: "无权限",
    };
  }

  try {
    // 查找所有没有 duration 但有 audioUrl 的音频
    const items = await db.query.audioData.findMany({
      where: or(isNull(audioData.duration), eq(audioData.duration, 0)),
      columns: {
        id: true,
        assetId: true,
        audioUrl: true,
      },
    });

    const itemsWithUrl = items.filter((item) => item.audioUrl);

    if (itemsWithUrl.length === 0) {
      return {
        success: true,
        fixed: 0,
        failed: 0,
        total: 0,
        details: [],
      };
    }

    const details: FixResult["details"] = [];
    let fixed = 0;
    let failed = 0;

    for (const item of itemsWithUrl) {
      try {
        // 使用 ffprobe 获取时长
        const duration = await getVideoDuration(item.audioUrl!);

        if (duration && duration > 0) {
          // 更新数据库
          await db
            .update(audioData)
            .set({ duration })
            .where(eq(audioData.id, item.id));

          details.push({
            id: item.id,
            audioUrl: item.audioUrl!,
            duration,
          });
          fixed++;
        } else {
          details.push({
            id: item.id,
            audioUrl: item.audioUrl!,
            duration: null,
            error: "无法获取时长",
          });
          failed++;
        }
      } catch (error) {
        details.push({
          id: item.id,
          audioUrl: item.audioUrl!,
          duration: null,
          error: error instanceof Error ? error.message : "处理失败",
        });
        failed++;
      }
    }

    return {
      success: true,
      fixed,
      failed,
      total: itemsWithUrl.length,
      details,
    };
  } catch (error) {
    console.error("批量修复失败:", error);
    return {
      success: false,
      fixed: 0,
      failed: 0,
      total: 0,
      details: [],
      error: error instanceof Error ? error.message : "批量修复失败",
    };
  }
}
