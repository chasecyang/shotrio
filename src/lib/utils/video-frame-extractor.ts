"use server";

import ffmpeg from "fluent-ffmpeg";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Config, getPublicUrl } from "@/lib/storage/r2.config";
import { AssetCategory } from "@/lib/storage/r2.service";
import { randomUUID } from "crypto";

/**
 * 从视频 URL 提取指定时间戳的帧
 * @param videoUrl - 视频的 URL 地址
 * @param timestamp - 时间戳（秒）
 * @param userId - 用户 ID
 * @returns 提取的帧图片 URL 或错误信息
 */
export async function extractFrameAtTimestamp(
  videoUrl: string,
  timestamp: number,
  userId: string
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    const r2Client = getR2Client();
    const { bucketName } = getR2Config();

    console.log(`[FrameExtractor] 开始从视频提取帧: ${videoUrl}, 时间戳: ${timestamp}s`);

    // 创建一个 Promise 来处理 ffmpeg 操作
    const frameBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let ffmpegEnded = false;
      let streamEnded = false;

      const tryResolve = () => {
        if (ffmpegEnded && streamEnded) {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        }
      };

      const command = ffmpeg(videoUrl)
        .inputOptions([`-ss ${timestamp}`]) // 定位到指定时间戳
        .outputOptions([
          "-vframes 1", // 只提取一帧
          "-f image2pipe", // 输出到管道
          "-vcodec png", // 使用 PNG 格式（无损）
        ])
        .on("start", (commandLine) => {
          console.log(`[FrameExtractor] FFmpeg 命令: ${commandLine}`);
        })
        .on("end", () => {
          ffmpegEnded = true;
          tryResolve();
        })
        .on("error", (err: Error) => {
          console.error(`[FrameExtractor] FFmpeg 错误:`, err);
          reject(err);
        });

      const stream = command.pipe();
      stream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      stream.on("end", () => {
        streamEnded = true;
        tryResolve();
      });
      stream.on("error", (err: Error) => {
        reject(err);
      });
    });

    console.log(`[FrameExtractor] 帧提取成功，大小: ${frameBuffer.length} bytes`);

    // 验证帧数据不为空
    if (frameBuffer.length === 0) {
      throw new Error("提取的帧数据为空，可能是时间戳超出视频范围或视频无法访问");
    }

    // 生成唯一的文件名
    const fileName = `frame-${Date.now()}-${randomUUID()}.png`;
    const key = `${userId}/${AssetCategory.PROJECTS}/${fileName}`;

    // 直接上传 Buffer 到 R2
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: frameBuffer,
      ContentType: "image/png",
      ContentLength: frameBuffer.length,
      Metadata: {
        userId,
        category: AssetCategory.PROJECTS,
        sourceVideoUrl: videoUrl,
        timestamp: timestamp.toString(),
        extractedAt: new Date().toISOString(),
      },
    });

    await r2Client.send(command);

    const url = getPublicUrl(key);
    if (!url) {
      throw new Error("未配置 R2_PUBLIC_DOMAIN，无法生成访问链接");
    }

    console.log(`[FrameExtractor] 帧上传成功: ${url}`);

    return {
      success: true,
      imageUrl: url,
    };
  } catch (error) {
    console.error("[FrameExtractor] 提取帧失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "提取帧失败",
    };
  }
}
