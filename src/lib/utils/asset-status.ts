/**
 * Asset状态计算工具函数
 *
 * 从数据库移除asset.status字段后，状态通过关联的job动态计算
 * 这个文件提供了所有状态计算相关的工具函数
 */

import type {
  Asset,
  AssetStatus,
  AssetWithFullData,
  AssetTag,
  GenerationInfo,
  ImageData,
  VideoData,
  TextData,
  AudioData,
} from "@/types/asset";
import type { Job } from "@/types/job";

/**
 * 检查资产是否有文件（根据类型检查对应扩展表）
 */
function hasAssetFile(
  assetType: string,
  imageData?: ImageData | null,
  videoData?: VideoData | null,
  textData?: TextData | null,
  audioData?: AudioData | null
): boolean {
  switch (assetType) {
    case "image":
      return !!imageData?.imageUrl;
    case "video":
      return !!videoData?.videoUrl;
    case "text":
      return !!textData?.textContent;
    case "audio":
      return !!audioData?.audioUrl;
    default:
      return false;
  }
}

/**
 * 计算资产的运行时状态
 *
 * 规则：
 * 1. 上传的资产（sourceType='uploaded'）直接返回 'completed'
 * 2. 生成的资产（sourceType='generated'）：
 *    - 如果有关联job，从job.status映射得到
 *    - 如果没有job但有文件URL，视为 'completed'
 *    - 如果没有job且没有文件URL：
 *      - 刚创建（5分钟内）：视为 'pending'（等待job创建）
 *      - 创建较久：视为 'failed'（孤立资产）
 */
export function calculateAssetStatus(
  asset: Asset,
  latestJob?: Job | null,
  imageData?: ImageData | null,
  videoData?: VideoData | null,
  textData?: TextData | null,
  audioData?: AudioData | null
): AssetStatus {
  // 上传的资产直接完成
  if (asset.sourceType === 'uploaded') {
    return 'completed';
  }

  // 生成类资产但没有job
  if (!latestJob) {
    // 如果有生成的文件，视为已完成
    if (hasAssetFile(asset.assetType, imageData, videoData, textData, audioData)) {
      return 'completed';
    }

    // 检查资产创建时间
    const assetAge = Date.now() - new Date(asset.createdAt).getTime();
    const fiveMinutes = 5 * 60 * 1000;

    // 如果是刚创建的（5分钟内），可能job还在创建中，视为pending
    if (assetAge < fiveMinutes) {
      return 'pending';
    }

    // 创建时间较久但没有job和文件，视为失败（孤立资产）
    return 'failed';
  }

  // 从job状态映射到asset状态
  const jobStatusMap: Record<string, AssetStatus> = {
    'pending': 'pending',
    'processing': 'processing',
    'completed': 'completed',
    'failed': 'failed',
    'cancelled': 'failed',
  };

  return jobStatusMap[latestJob.status] || 'failed';
}

/**
 * 获取资产的错误信息
 */
export function getAssetErrorMessage(
  asset: Asset,
  latestJob?: Job | null
): string | null {
  if (asset.sourceType === 'uploaded') {
    return null;
  }
  return latestJob?.errorMessage || null;
}

/**
 * 为资产附加运行时状态和扁平化便捷属性
 */
export function enrichAssetWithFullData(
  asset: Asset,
  tags: AssetTag[],
  generationInfo: GenerationInfo | null,
  imageData: ImageData | null,
  videoData: VideoData | null,
  textData: TextData | null,
  audioData: AudioData | null,
  latestJob?: Job | null
): AssetWithFullData {
  // 计算 displayUrl：显示用 URL，优先缩略图
  const displayUrl = (() => {
    switch (asset.assetType) {
      case "image":
        return imageData?.thumbnailUrl || imageData?.imageUrl || null;
      case "video":
        return imageData?.thumbnailUrl || null; // 视频使用图片缩略图
      default:
        return null;
    }
  })();

  // 计算 mediaUrl：实际媒体源 URL
  const mediaUrl = (() => {
    switch (asset.assetType) {
      case "image":
        return imageData?.imageUrl || null;
      case "video":
        return videoData?.videoUrl || null;
      case "audio":
        return audioData?.audioUrl || null;
      default:
        return null;
    }
  })();

  // 计算 duration：视频或音频时长
  const duration = videoData?.duration ?? audioData?.duration ?? null;

  return {
    ...asset,
    tags,
    generationInfo,
    imageData,
    videoData,
    textData,
    audioData,
    runtimeStatus: calculateAssetStatus(asset, latestJob, imageData, videoData, textData, audioData),
    errorMessage: getAssetErrorMessage(asset, latestJob),

    // 扁平化便捷属性
    displayUrl,
    mediaUrl,
    imageUrl: imageData?.imageUrl ?? null,
    thumbnailUrl: imageData?.thumbnailUrl ?? null,
    videoUrl: videoData?.videoUrl ?? null,
    audioUrl: audioData?.audioUrl ?? null,
    textContent: textData?.textContent ?? null,
    duration,
    prompt: generationInfo?.prompt ?? null,
    seed: generationInfo?.seed ?? null,
    modelUsed: generationInfo?.modelUsed ?? null,
    generationConfig: generationInfo?.generationConfig ?? null,
    sourceAssetIds: generationInfo?.sourceAssetIds ?? null,
    latestJobId: latestJob?.id ?? null,
  };
}

/**
 * 批量为资产附加运行时状态
 */
export function enrichAssetsWithFullData(
  assetsWithRelations: Array<{
    id: string;
    projectId: string;
    userId: string;
    name: string;
    assetType: string;
    sourceType: string;
    meta: string | null;
    order: number | null;
    usageCount: number;
    createdAt: Date;
    updatedAt: Date;
    tags: AssetTag[];
    generationInfo: GenerationInfo | null;
    imageData: ImageData | null;
    videoData: VideoData | null;
    textData: TextData | null;
    audioData: AudioData | null;
  }>,
  jobsMap: Map<string, Job>
): AssetWithFullData[] {
  return assetsWithRelations.map((assetData) => {
    const latestJob = jobsMap.get(assetData.id);
    return enrichAssetWithFullData(
      assetData as Asset,
      assetData.tags,
      assetData.generationInfo,
      assetData.imageData,
      assetData.videoData,
      assetData.textData,
      assetData.audioData,
      latestJob
    );
  });
}

/**
 * 检查资产是否处于生成中状态
 */
export function isAssetGenerating(asset: AssetWithFullData): boolean {
  return asset.runtimeStatus === 'pending' || asset.runtimeStatus === 'processing';
}

/**
 * 检查资产是否失败
 */
export function isAssetFailed(asset: AssetWithFullData): boolean {
  return asset.runtimeStatus === 'failed';
}

/**
 * 检查资产是否已完成
 */
export function isAssetCompleted(asset: AssetWithFullData): boolean {
  return asset.runtimeStatus === 'completed';
}

/**
 * 获取资产状态的显示文本
 */
export function getAssetStatusText(status: AssetStatus): string {
  const statusTextMap: Record<AssetStatus, string> = {
    'pending': '等待中',
    'processing': '生成中',
    'completed': '已完成',
    'failed': '失败',
  };
  return statusTextMap[status];
}

/**
 * 检查资产是否可用于交互（已完成且有媒体文件）
 * 用于替代 `!asset.imageUrl` 等判断
 */
export function isAssetReady(asset: AssetWithFullData): boolean {
  if (asset.runtimeStatus !== 'completed') return false;

  switch (asset.assetType) {
    case "image":
      return !!asset.imageUrl;
    case "video":
      return !!asset.videoUrl;
    case "text":
      return !!asset.textContent;
    case "audio":
      return !!asset.audioUrl;
    default:
      return false;
  }
}

/**
 * 检查资产是否有可显示的缩略图/预览图
 */
export function hasDisplayableMedia(asset: AssetWithFullData): boolean {
  return !!asset.displayUrl;
}
