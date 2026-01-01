/**
 * Asset状态计算工具函数
 * 
 * 从数据库移除asset.status字段后，状态通过关联的job动态计算
 * 这个文件提供了所有状态计算相关的工具函数
 */

import type { Asset, AssetStatus, AssetWithRuntimeStatus, AssetTag } from "@/types/asset";
import type { Job } from "@/types/job";

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
 * 
 * @param asset - 资产对象
 * @param latestJob - 关联的最新job（可选）
 * @returns 计算得出的资产状态
 */
export function calculateAssetStatus(
  asset: Asset,
  latestJob?: Job | null
): AssetStatus {
  // 上传的资产直接完成
  if (asset.sourceType === 'uploaded') {
    return 'completed';
  }
  
  // 生成类资产但没有job
  if (!latestJob) {
    // 如果有生成的文件，视为已完成
    if (asset.imageUrl || asset.videoUrl) {
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
    'cancelled': 'failed', // 取消的任务视为失败
  };
  
  return jobStatusMap[latestJob.status] || 'failed';
}

/**
 * 获取资产的错误信息
 * 
 * 规则：
 * 1. 上传的资产没有错误信息
 * 2. 生成的资产从关联的job获取错误信息
 * 
 * @param asset - 资产对象
 * @param latestJob - 关联的最新job（可选）
 * @returns 错误信息字符串，如果没有错误返回null
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
 * 为资产附加运行时状态
 * 
 * 将Asset对象转换为AssetWithRuntimeStatus对象
 * 添加运行时计算的状态、关联job和错误信息
 * 
 * @param asset - 基础资产对象
 * @param tags - 资产标签数组
 * @param latestJob - 关联的最新job（可选）
 * @returns 带运行时状态的资产对象
 */
export function enrichAssetWithStatus(
  asset: Asset,
  tags: AssetTag[],
  latestJob?: Job | null
): AssetWithRuntimeStatus {
  return {
    ...asset,
    tags,
    runtimeStatus: calculateAssetStatus(asset, latestJob),
    latestJob: latestJob || undefined,
    errorMessage: getAssetErrorMessage(asset, latestJob),
  };
}

/**
 * 批量为资产附加运行时状态
 * 
 * @param assetsWithTags - 带标签的资产数组
 * @param jobsMap - job映射表 (assetId -> Job)
 * @returns 带运行时状态的资产数组
 */
export function enrichAssetsWithStatus(
  assetsWithTags: Array<Asset & { tags: AssetTag[] }>,
  jobsMap: Map<string, Job>
): AssetWithRuntimeStatus[] {
  return assetsWithTags.map((assetWithTags) => {
    const latestJob = jobsMap.get(assetWithTags.id);
    return enrichAssetWithStatus(assetWithTags, assetWithTags.tags, latestJob);
  });
}

/**
 * 检查资产是否处于生成中状态
 * 
 * @param asset - 带运行时状态的资产
 * @returns 是否正在生成
 */
export function isAssetGenerating(asset: AssetWithRuntimeStatus): boolean {
  return asset.runtimeStatus === 'pending' || asset.runtimeStatus === 'processing';
}

/**
 * 检查资产是否失败
 * 
 * @param asset - 带运行时状态的资产
 * @returns 是否失败
 */
export function isAssetFailed(asset: AssetWithRuntimeStatus): boolean {
  return asset.runtimeStatus === 'failed';
}

/**
 * 检查资产是否已完成
 * 
 * @param asset - 带运行时状态的资产
 * @returns 是否已完成
 */
export function isAssetCompleted(asset: AssetWithRuntimeStatus): boolean {
  return asset.runtimeStatus === 'completed';
}

/**
 * 获取资产状态的显示文本
 * 
 * @param status - 资产状态
 * @returns 显示文本
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

