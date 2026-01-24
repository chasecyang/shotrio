"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { extractFrameAtTimestamp } from "@/lib/utils/video-frame-extractor";
import { createAsset } from "@/lib/actions/asset/base-crud";
import { getAssetWithFullData } from "@/lib/actions/asset/get-asset";
import type { AssetWithFullData, ExtractionInfo } from "@/types/asset";

interface CaptureVideoFrameInput {
  projectId: string;
  sourceVideoAssetId: string;
  videoUrl: string;
  timestamp: number; // 秒
  frameName?: string;
}

/**
 * 从视频中截取指定时间戳的画面，保存为新的图片素材
 */
export async function captureVideoFrame(
  input: CaptureVideoFrameInput
): Promise<{
  success: boolean;
  asset?: AssetWithFullData;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { success: false, error: "未登录" };
  }

  try {
    const { projectId, sourceVideoAssetId, videoUrl, timestamp, frameName } = input;

    // 1. 使用 FFmpeg 提取帧
    console.log(`[CaptureFrame] 开始截取视频帧: ${videoUrl}, 时间戳: ${timestamp}s`);
    const extractResult = await extractFrameAtTimestamp(
      videoUrl,
      timestamp,
      session.user.id
    );

    if (!extractResult.success || !extractResult.imageUrl) {
      return {
        success: false,
        error: extractResult.error || "画面截取失败",
      };
    }

    // 2. 格式化时间戳用于默认名称
    const formatTimestamp = (seconds: number): string => {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const defaultName = frameName || `视频截图 - ${formatTimestamp(timestamp)}`;

    // 3. 构建提取信息元数据
    const extractionInfo: ExtractionInfo = {
      sourceVideoAssetId,
      timestamp,
      extractedAt: new Date().toISOString(),
      extractionMethod: "ffmpeg",
    };

    // 4. 创建图片素材
    const createResult = await createAsset({
      projectId,
      name: defaultName.trim(),
      assetType: "image",
      sourceType: "extracted", // 标记为提取类素材
      tags: [],
      imageData: {
        imageUrl: extractResult.imageUrl,
        thumbnailUrl: extractResult.imageUrl, // 使用相同的 URL
        sourceAssetIds: [sourceVideoAssetId], // 关联源视频
      },
      meta: {
        extractionInfo,
      },
    });

    if (!createResult.success || !createResult.asset) {
      return {
        success: false,
        error: createResult.error || "创建素材记录失败",
      };
    }

    console.log(`[CaptureFrame] 素材创建成功: ${createResult.asset.id}`);

    // 5. 获取完整的素材数据（包含扁平化属性）
    const fullDataResult = await getAssetWithFullData(createResult.asset.id);

    if (!fullDataResult.success || !fullDataResult.asset) {
      // 即使获取完整数据失败，素材已经创建成功
      return {
        success: true,
        asset: undefined,
      };
    }

    return {
      success: true,
      asset: fullDataResult.asset,
    };
  } catch (error) {
    console.error("[CaptureFrame] 截取画面失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "截取画面失败",
    };
  }
}
