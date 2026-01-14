/**
 * 波形数据序列化/反序列化工具
 * 这些是纯客户端工具函数，不需要服务端执行
 */

/**
 * 将波形数据序列化为 JSON 字符串
 * @param waveform - 波形数据数组
 * @returns JSON 字符串
 */
export function serializeWaveform(waveform: number[]): string {
  // 将浮点数转换为 0-255 的整数以减少存储空间
  const compressed = waveform.map((v) => Math.round(v * 255));
  return JSON.stringify(compressed);
}

/**
 * 从 JSON 字符串反序列化波形数据
 * @param data - JSON 字符串
 * @returns 波形数据数组（0-1 范围）
 */
export function deserializeWaveform(data: string): number[] {
  try {
    const compressed: number[] = JSON.parse(data);
    return compressed.map((v) => v / 255);
  } catch {
    return [];
  }
}
