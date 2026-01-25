/**
 * Aspect ratio utility functions
 * Handles parsing and calculating aspect ratios for asset display
 */

import type { AssetWithFullData } from "@/types/asset";

/**
 * Parse aspect ratio string to numeric value
 * @param ratio - Aspect ratio string like "16:9", "9:16", "1:1"
 * @returns Numeric ratio (width/height)
 */
export function parseAspectRatio(ratio: string): number {
  const [width, height] = ratio.split(":").map(Number);
  if (!width || !height || isNaN(width) || isNaN(height)) {
    return 16 / 9; // Default fallback
  }
  return width / height;
}

/**
 * Extract aspect ratio from asset's generationConfig
 * @param asset - Asset with full data
 * @returns Aspect ratio string or null
 */
export function getAssetAspectRatio(asset: AssetWithFullData): string | null {
  if (!asset.generationConfig) return null;

  try {
    const config = JSON.parse(asset.generationConfig);
    // Handle both image and video config formats
    return config.aspectRatio || config.aspect_ratio || null;
  } catch {
    return null;
  }
}

/**
 * Calculate padding-bottom percentage for aspect ratio container
 * @param aspectRatio - Aspect ratio string like "16:9"
 * @returns Padding-bottom percentage string
 */
export function getAspectRatioPadding(aspectRatio: string): string {
  const ratio = parseAspectRatio(aspectRatio);
  const paddingPercent = (1 / ratio) * 100;
  return `${paddingPercent}%`;
}

/**
 * Get aspect ratio for asset with fallback
 * @param asset - Asset with full data
 * @returns Aspect ratio string (defaults to "16:9")
 */
export function getAssetAspectRatioWithFallback(
  asset: AssetWithFullData
): string {
  const ratio = getAssetAspectRatio(asset);
  return ratio || "16:9";
}

/**
 * Get aspect ratio category
 * @param aspectRatio - Aspect ratio string like "16:9"
 * @returns Category of the aspect ratio
 */
export function getAspectRatioCategory(
  aspectRatio: string
): "ultra-wide" | "landscape" | "square" | "portrait" | "ultra-portrait" {
  const ratio = parseAspectRatio(aspectRatio);

  if (ratio >= 2.1) return "ultra-wide"; // 21:9 and above
  if (ratio >= 1.3) return "landscape"; // 16:9, 3:2, 4:3
  if (ratio >= 0.8) return "square"; // 1:1, 5:4, 4:5
  if (ratio >= 0.5) return "portrait"; // 3:4, 2:3
  return "ultra-portrait"; // 9:16 and below
}

/**
 * Get Grid column span class for aspect ratio
 * Based on responsive grid: 2 cols (mobile), 4 cols (sm), 6 cols (lg), 8 cols (xl), 10 cols (2xl)
 * Landscape items are always 2x the size of portrait items for consistent visual balance
 * @param aspectRatio - Aspect ratio string like "16:9"
 * @returns Tailwind CSS class for grid column span
 */
export function getGridColumnSpan(aspectRatio: string): string {
  const category = getAspectRatioCategory(aspectRatio);

  switch (category) {
    case "ultra-wide":
      // Ultra-wide is 3x portrait size: Mobile: full, sm: 3/4, lg: 3/6, xl: 6/8, 2xl: 6/10
      return "col-span-2 sm:col-span-3 lg:col-span-3 xl:col-span-6 2xl:col-span-6";
    case "landscape":
      // Landscape is 2x portrait size: Mobile: full, sm: 2/4, lg: 2/6, xl: 4/8, 2xl: 4/10
      return "col-span-2 sm:col-span-2 lg:col-span-2 xl:col-span-4 2xl:col-span-4";
    case "square":
      // Square is 1.5x portrait size: Mobile: 1/2, sm: 1.5/4, lg: 1.5/6, xl: 3/8, 2xl: 3/10
      return "col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-3 2xl:col-span-3";
    case "portrait":
      // Portrait base size: Mobile: 1/2, sm: 1/4, lg: 1/6, xl: 2/8, 2xl: 2/10
      return "col-span-1 sm:col-span-1 lg:col-span-1 xl:col-span-2 2xl:col-span-2";
    case "ultra-portrait":
      // Ultra-portrait same as portrait: Mobile: 1/2, sm: 1/4, lg: 1/6, xl: 2/8, 2xl: 2/10
      return "col-span-1 sm:col-span-1 lg:col-span-1 xl:col-span-2 2xl:col-span-2";
    default:
      return "col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-3 2xl:col-span-3";
  }
}
