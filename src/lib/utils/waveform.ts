"use server";

import ffmpeg from "fluent-ffmpeg";
import { serializeWaveform } from "./waveform-utils";

// 重新导出工具函数供其他服务端代码使用
export { serializeWaveform };

/**
 * 从音频 URL 提取波形数据
 * @param audioUrl - 音频的 URL 地址
 * @param samples - 采样点数量，默认 200
 * @returns 波形数据数组（0-1 范围的振幅值）
 */
export async function extractWaveform(
  audioUrl: string,
  samples: number = 200
): Promise<{ success: boolean; waveform?: number[]; error?: string }> {
  try {
    console.log(`[Waveform] 开始从音频提取波形: ${audioUrl}`);

    // 使用 FFmpeg 提取音频的原始 PCM 数据
    const rawData = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      ffmpeg(audioUrl)
        .outputOptions([
          "-f s16le", // 16位有符号小端格式
          "-acodec pcm_s16le",
          "-ac 1", // 单声道
          "-ar 8000", // 低采样率以减少数据量
        ])
        .on("start", (commandLine) => {
          console.log(`[Waveform] FFmpeg 命令: ${commandLine}`);
        })
        .on("error", (err: Error) => {
          console.error(`[Waveform] FFmpeg 错误:`, err);
          reject(err);
        })
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

    console.log(`[Waveform] PCM 数据提取成功，大小: ${rawData.length} bytes`);

    // 将 PCM 数据转换为波形采样点
    const waveform = processRawAudioToWaveform(rawData, samples);

    console.log(`[Waveform] 波形生成成功，采样点数: ${waveform.length}`);

    return {
      success: true,
      waveform,
    };
  } catch (error) {
    console.error("[Waveform] 提取波形失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "提取波形失败",
    };
  }
}

/**
 * 将原始 PCM 数据处理为波形采样点
 * @param rawData - 原始 16 位 PCM 数据
 * @param samples - 目标采样点数量
 * @returns 归一化后的波形数据（0-1 范围）
 */
function processRawAudioToWaveform(rawData: Buffer, samples: number): number[] {
  // 16 位 PCM，每个采样 2 字节
  const totalSamples = rawData.length / 2;

  if (totalSamples === 0) {
    return new Array(samples).fill(0);
  }

  // 计算每个输出采样点对应的输入采样数
  const samplesPerPoint = Math.floor(totalSamples / samples);

  if (samplesPerPoint === 0) {
    // 输入数据太少，直接返回现有数据
    const waveform: number[] = [];
    for (let i = 0; i < rawData.length; i += 2) {
      const value = rawData.readInt16LE(i);
      const normalized = Math.abs(value) / 32768;
      waveform.push(normalized);
    }
    // 填充到目标长度
    while (waveform.length < samples) {
      waveform.push(0);
    }
    return waveform.slice(0, samples);
  }

  const waveform: number[] = [];

  for (let i = 0; i < samples; i++) {
    const startSample = i * samplesPerPoint;
    const endSample = Math.min(startSample + samplesPerPoint, totalSamples);

    // 计算这个区间内的最大绝对值（峰值）
    let maxValue = 0;
    for (let j = startSample; j < endSample; j++) {
      const byteOffset = j * 2;
      if (byteOffset + 1 < rawData.length) {
        const value = Math.abs(rawData.readInt16LE(byteOffset));
        if (value > maxValue) {
          maxValue = value;
        }
      }
    }

    // 归一化到 0-1 范围
    const normalized = maxValue / 32768;
    waveform.push(Math.min(1, normalized));
  }

  return waveform;
}
