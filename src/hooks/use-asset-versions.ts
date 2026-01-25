"use client";

import { useCallback, useState, useTransition } from "react";
import { setActiveVersion, deleteAssetVersion } from "@/lib/actions/asset";
import { useTranslations } from "next-intl";
import type { ImageData, VideoData, AssetWithFullData } from "@/types/asset";

type Version = ImageData | VideoData;

interface UseAssetVersionsOptions {
  onVersionChange?: () => void;
}

/**
 * Asset version management Hook
 */
export function useAssetVersions(
  asset: AssetWithFullData,
  options?: UseAssetVersionsOptions
) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("toasts");

  // Get version list
  const versions: Version[] =
    asset.assetType === "image"
      ? asset.imageDataList || []
      : asset.assetType === "video"
        ? asset.videoDataList || []
        : [];

  // Current active version
  const activeVersion =
    asset.assetType === "image"
      ? asset.imageData
      : asset.assetType === "video"
        ? asset.videoData
        : null;

  // Switch active version
  const switchVersion = useCallback(
    async (versionId: string) => {
      if (!versionId || versionId === activeVersion?.id) return;

      setError(null);
      startTransition(async () => {
        const result = await setActiveVersion(asset.id, versionId);
        if (!result.success) {
          setError(result.error || t("error.operationFailed"));
          return;
        }
        options?.onVersionChange?.();
      });
    },
    [asset.id, activeVersion?.id, options, t]
  );

  // Delete version
  const removeVersion = useCallback(
    async (versionId: string) => {
      if (!versionId) return;

      // Cannot delete the only version
      if (versions.length <= 1) {
        setError(t("error.operationFailed"));
        return;
      }

      setError(null);
      startTransition(async () => {
        const result = await deleteAssetVersion(versionId);
        if (!result.success) {
          setError(result.error || t("error.deleteFailed"));
          return;
        }
        options?.onVersionChange?.();
      });
    },
    [versions.length, options, t]
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
