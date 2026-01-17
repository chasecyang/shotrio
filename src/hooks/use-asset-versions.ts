"use client";

import { useCallback, useState, useTransition } from "react";
import { setActiveVersion, deleteAssetVersion } from "@/lib/actions/asset";
import type { ImageData, VideoData, AssetWithFullData } from "@/types/asset";

type Version = ImageData | VideoData;

interface UseAssetVersionsOptions {
  onVersionChange?: () => void;
}

/**
 * Asset 版本管理 Hook
 *
 * 功能：
 * - 获取当前资产的所有版本
 * - 切换激活版本
 * - 删除版本
 */
export function useAssetVersions(
  asset: AssetWithFullData,
  options?: UseAssetVersionsOptions
) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 获取版本列表
  const versions: Version[] =
    asset.assetType === "image"
      ? asset.imageDataList || []
      : asset.assetType === "video"
        ? asset.videoDataList || []
        : [];

  // 当前激活版本
  const activeVersion =
    asset.assetType === "image"
      ? asset.imageData
      : asset.assetType === "video"
        ? asset.videoData
        : null;

  // 切换激活版本
  const switchVersion = useCallback(
    async (versionId: string) => {
      if (!versionId || versionId === activeVersion?.id) return;

      setError(null);
      startTransition(async () => {
        const result = await setActiveVersion(asset.id, versionId);
        if (!result.success) {
          setError(result.error || "切换版本失败");
          return;
        }
        options?.onVersionChange?.();
      });
    },
    [asset.id, activeVersion?.id, options]
  );

  // 删除版本
  const removeVersion = useCallback(
    async (versionId: string) => {
      if (!versionId) return;

      // 不能删除唯一的版本
      if (versions.length <= 1) {
        setError("无法删除唯一的版本");
        return;
      }

      setError(null);
      startTransition(async () => {
        const result = await deleteAssetVersion(versionId);
        if (!result.success) {
          setError(result.error || "删除版本失败");
          return;
        }
        options?.onVersionChange?.();
      });
    },
    [versions.length, options]
  );

  return {
    versions,
    activeVersion,
    versionCount: versions.length,
    isPending,
    error,
    switchVersion,
    removeVersion,
  };
}
