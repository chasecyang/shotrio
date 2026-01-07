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
 *
 * @param imageDataList - 图片数据版本列表（新版本化结构）
 * @param videoDataList - 视频数据版本列表（新版本化结构）
 */
export function enrichAssetWithFullData(
  asset: Asset,
  tags: AssetTag[],
  imageDataList: ImageData[],
  videoDataList: VideoData[],
  textData: TextData | null,
  audioData: AudioData | null,
  latestJob?: Job | null
): AssetWithFullData {
  // 找到激活版本
  const activeImageData = imageDataList.find((v) => v.isActive) ?? imageDataList[0] ?? null;
  const activeVideoData = videoDataList.find((v) => v.isActive) ?? videoDataList[0] ?? null;

  // 计算版本数
  const versionCount = imageDataList.length + videoDataList.length;

  // 计算 displayUrl：显示用 URL，优先缩略图
  const displayUrl = (() => {
    switch (asset.assetType) {
      case "image":
        return activeImageData?.thumbnailUrl || activeImageData?.imageUrl || null;
      case "video":
        return activeVideoData?.thumbnailUrl || null;
      default:
        return null;
    }
  })();

  // 计算 mediaUrl：实际媒体源 URL
  const mediaUrl = (() => {
    switch (asset.assetType) {
      case "image":
        return activeImageData?.imageUrl || null;
      case "video":
        return activeVideoData?.videoUrl || null;
      case "audio":
        return audioData?.audioUrl || null;
      default:
        return null;
    }
  })();

  // 计算 duration：视频或音频时长
  const duration = activeVideoData?.duration ?? audioData?.duration ?? null;

  // 从激活版本获取生成信息
  const prompt = activeImageData?.prompt ?? activeVideoData?.prompt ?? audioData?.prompt ?? null;
  const seed = activeImageData?.seed ?? activeVideoData?.seed ?? audioData?.seed ?? null;
  const modelUsed = activeImageData?.modelUsed ?? activeVideoData?.modelUsed ?? audioData?.modelUsed ?? null;
  const generationConfig = activeImageData?.generationConfig ?? activeVideoData?.generationConfig ?? audioData?.generationConfig ?? null;
  const sourceAssetIds = activeImageData?.sourceAssetIds ?? activeVideoData?.sourceAssetIds ?? audioData?.sourceAssetIds ?? null;

  return {
    ...asset,
    tags,
    // 当前激活版本
    imageData: activeImageData,
    videoData: activeVideoData,
    textData,
    audioData,
    // 所有版本列表
    imageDataList,
    videoDataList,
    versionCount,
    // 运行时状态
    runtimeStatus: calculateAssetStatus(asset, latestJob, activeImageData, activeVideoData, textData, audioData),
    errorMessage: getAssetErrorMessage(asset, latestJob),

    // 扁平化便捷属性
    displayUrl,
    mediaUrl,
    imageUrl: activeImageData?.imageUrl ?? null,
    thumbnailUrl: activeImageData?.thumbnailUrl ?? activeVideoData?.thumbnailUrl ?? null,
    videoUrl: activeVideoData?.videoUrl ?? null,
    audioUrl: audioData?.audioUrl ?? null,
    textContent: textData?.textContent ?? null,
    duration,
    prompt,
    seed,
    modelUsed,
    generationConfig,
    sourceAssetIds,
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
    imageDataList: ImageData[];
    videoDataList: VideoData[];
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
      assetData.imageDataList ?? [],
      assetData.videoDataList ?? [],
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
