import JSZip from "jszip";
import { AssetWithFullData } from "@/types/asset";

/**
 * 下载进度回调
 */
export interface DownloadProgress {
  current: number;
  total: number;
  phase: "fetching" | "zipping" | "downloading";
}

/**
 * 下载结果
 */
export interface DownloadResult {
  success: boolean;
  downloadedCount: number;
  failedCount: number;
  failedAssets: string[];
}

/**
 * 根据素材类型获取文件扩展名
 */
function getFileExtension(asset: AssetWithFullData): string {
  switch (asset.assetType) {
    case "image":
      if (asset.mediaUrl) {
        try {
          const url = new URL(asset.mediaUrl);
          const path = url.pathname.toLowerCase();
          if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return ".jpg";
          if (path.endsWith(".webp")) return ".webp";
          if (path.endsWith(".gif")) return ".gif";
        } catch {
          // URL 解析失败，使用默认扩展名
        }
      }
      return ".png";
    case "video":
      return ".mp4";
    case "audio":
      return ".mp3";
    case "text":
      return ".txt";
    default:
      return "";
  }
}

/**
 * 获取素材的下载 URL
 */
function getDownloadUrl(asset: AssetWithFullData): string | null {
  switch (asset.assetType) {
    case "image":
      return asset.imageUrl || asset.mediaUrl;
    case "video":
      return asset.videoUrl || asset.mediaUrl;
    case "audio":
      return asset.audioUrl || asset.mediaUrl;
    case "text":
      return null;
    default:
      return null;
  }
}

/**
 * 生成唯一文件名（处理重名情况）
 */
function generateUniqueFileName(
  baseName: string,
  extension: string,
  existingNames: Set<string>
): string {
  const cleanName = baseName.replace(/[<>:"/\\|?*]/g, "_");
  let fileName = `${cleanName}${extension}`;
  let counter = 1;

  while (existingNames.has(fileName)) {
    fileName = `${cleanName}_${counter}${extension}`;
    counter++;
  }

  existingNames.add(fileName);
  return fileName;
}

/**
 * 批量下载素材为 ZIP 文件
 */
export async function batchDownloadAssets(
  assets: AssetWithFullData[],
  onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadResult> {
  const zip = new JSZip();
  const existingNames = new Set<string>();
  const failedAssets: string[] = [];
  let downloadedCount = 0;

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const extension = getFileExtension(asset);
    const fileName = generateUniqueFileName(asset.name, extension, existingNames);

    onProgress?.({
      current: i + 1,
      total: assets.length,
      phase: "fetching",
    });

    try {
      if (asset.assetType === "text") {
        const content = asset.textContent || "";
        zip.file(fileName, content);
        downloadedCount++;
      } else {
        const url = getDownloadUrl(asset);
        if (!url) {
          failedAssets.push(asset.name);
          continue;
        }

        const response = await fetch(url);
        if (!response.ok) {
          failedAssets.push(asset.name);
          continue;
        }

        const blob = await response.blob();
        zip.file(fileName, blob);
        downloadedCount++;
      }
    } catch (error) {
      console.error(`Failed to download asset: ${asset.name}`, error);
      failedAssets.push(asset.name);
    }
  }

  if (downloadedCount === 0) {
    return {
      success: false,
      downloadedCount: 0,
      failedCount: assets.length,
      failedAssets,
    };
  }

  onProgress?.({
    current: assets.length,
    total: assets.length,
    phase: "zipping",
  });

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  onProgress?.({
    current: assets.length,
    total: assets.length,
    phase: "downloading",
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  const zipFileName = `assets_${timestamp}.zip`;

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return {
    success: true,
    downloadedCount,
    failedCount: failedAssets.length,
    failedAssets,
  };
}
