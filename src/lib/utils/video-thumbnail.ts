"use server";

import ffmpeg from "fluent-ffmpeg";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_CONFIG, getPublicUrl } from "@/lib/storage/r2.config";
import { AssetCategory } from "@/lib/storage/r2.service";
import { randomUUID } from "crypto";

/**
 * 从视频 URL 提取第一帧作为缩略图
 * @param videoUrl - 视频的 URL 地址
 * @param userId - 用户 ID
 * @returns 缩略图的 URL 或 null（失败时）
 */
export async function extractVideoThumbnail(
  videoUrl: string,
  userId: string
): Promise<{ success: boolean; thumbnailUrl?: string; error?: string }> {
  try {
    console.log(`[Thumbnail] 开始从视频提取缩略图: ${videoUrl}`);

    // 创建一个 Promise 来处理 ffmpeg 操作
    const thumbnailBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      ffmpeg(videoUrl)
        .screenshots({
          timestamps: ["00:00:00.000"], // 提取第一帧
          size: "1280x720", // 缩略图尺寸
        })
        .outputOptions([
          "-f image2pipe", // 输出到管道
          "-vcodec png", // 使用 PNG 格式
        ])
        .pipe()
        .on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        })
        .on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        })
        .on("error", (err: Error) => {
          reject(err);
        });
    });

    console.log(`[Thumbnail] 缩略图提取成功，大小: ${thumbnailBuffer.length} bytes`);

    // 生成唯一的文件名
    const fileName = `thumbnail-${randomUUID()}.png`;
    const key = `${userId}/${AssetCategory.THUMBNAILS}/${fileName}`;

    // 直接上传 Buffer 到 R2
    const command = new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
      Body: thumbnailBuffer,
      ContentType: "image/png",
      ContentLength: thumbnailBuffer.length,
      Metadata: {
        userId,
        category: AssetCategory.THUMBNAILS,
        sourceVideoUrl: videoUrl,
        extractedAt: new Date().toISOString(),
      },
    });

    await r2Client.send(command);

    const url = getPublicUrl(key);
    if (!url) {
      throw new Error("未配置 R2_PUBLIC_DOMAIN，无法生成访问链接");
    }

    console.log(`[Thumbnail] 缩略图上传成功: ${url}`);

    return {
      success: true,
      thumbnailUrl: url,
    };
  } catch (error) {
    console.error("[Thumbnail] 提取缩略图失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "提取缩略图失败",
    };
  }
}

/**
 * 从本地视频文件提取缩略图
 * @param videoPath - 本地视频文件路径
 * @param userId - 用户 ID
 * @returns 缩略图的 URL 或 null（失败时）
 */
export async function extractVideoThumbnailFromFile(
  videoPath: string,
  userId: string
): Promise<{ success: boolean; thumbnailUrl?: string; error?: string }> {
  try {
    console.log(`[Thumbnail] 开始从本地视频提取缩略图: ${videoPath}`);

    const thumbnailBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      ffmpeg(videoPath)
        .screenshots({
          timestamps: ["00:00:00.000"],
          size: "1280x720",
        })
        .outputOptions(["-f image2pipe", "-vcodec png"])
        .pipe()
        .on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        })
        .on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        })
        .on("error", (err: Error) => {
          reject(err);
        });
    });

    console.log(`[Thumbnail] 缩略图提取成功，大小: ${thumbnailBuffer.length} bytes`);

    // 生成唯一的文件名
    const fileName = `thumbnail-${randomUUID()}.png`;
    const key = `${userId}/${AssetCategory.THUMBNAILS}/${fileName}`;

    // 直接上传 Buffer 到 R2
    const command = new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
      Body: thumbnailBuffer,
      ContentType: "image/png",
      ContentLength: thumbnailBuffer.length,
      Metadata: {
        userId,
        category: AssetCategory.THUMBNAILS,
        sourceVideoPath: videoPath,
        extractedAt: new Date().toISOString(),
      },
    });

    await r2Client.send(command);

    const url = getPublicUrl(key);
    if (!url) {
      throw new Error("未配置 R2_PUBLIC_DOMAIN，无法生成访问链接");
    }

    console.log(`[Thumbnail] 缩略图上传成功: ${url}`);

    return {
      success: true,
      thumbnailUrl: url,
    };
  } catch (error) {
    console.error("[Thumbnail] 提取缩略图失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "提取缩略图失败",
    };
  }
}

