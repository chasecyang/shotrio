import { Image, Video, Music, FileText } from "lucide-react";
import type { AssetWithFullData, AssetTypeEnum } from "@/types/asset";

/**
 * 获取素材类型对应的图标组件
 * @param assetOrType - AssetWithFullData 对象或 AssetTypeEnum 字符串
 * @param className - 可选的 CSS 类名
 * @returns 对应的图标组件或 null
 */
export function getAssetIcon(
  assetOrType: AssetWithFullData | AssetTypeEnum,
  className?: string
) {
  let type: AssetTypeEnum;

  // 判断是对象还是字符串
  if (typeof assetOrType === "string") {
    type = assetOrType;
  } else {
    // 根据数据属性判断类型
    if (assetOrType.imageData) type = "image";
    else if (assetOrType.videoData) type = "video";
    else if (assetOrType.audioData) type = "audio";
    else if (assetOrType.textData) type = "text";
    else type = assetOrType.assetType;
  }

  // 返回对应的图标
  switch (type) {
    case "image":
      return <Image className={className} />;
    case "video":
      return <Video className={className} />;
    case "audio":
      return <Music className={className} />;
    case "text":
      return <FileText className={className} />;
    default:
      return null;
  }
}

/**
 * 获取素材类型的中文名称
 * @param assetOrType - AssetWithFullData 对象或 AssetTypeEnum 字符串
 * @returns 中文类型名称
 */
export function getAssetTypeName(
  assetOrType: AssetWithFullData | AssetTypeEnum
): string {
  let type: AssetTypeEnum;

  if (typeof assetOrType === "string") {
    type = assetOrType;
  } else {
    if (assetOrType.imageData) type = "image";
    else if (assetOrType.videoData) type = "video";
    else if (assetOrType.audioData) type = "audio";
    else if (assetOrType.textData) type = "text";
    else type = assetOrType.assetType;
  }

  switch (type) {
    case "image":
      return "图片";
    case "video":
      return "视频";
    case "audio":
      return "音频";
    case "text":
      return "文本";
    default:
      return "素材";
  }
}

/**
 * 根据素材名称猜测类型（用于没有完整类型信息的场景）
 * @param name - 素材名称
 * @returns 猜测的素材类型
 */
export function guessAssetTypeFromName(name: string): AssetTypeEnum {
  const lowerName = name.toLowerCase();

  if (lowerName.includes("video") || lowerName.includes("视频")) {
    return "video";
  }
  if (lowerName.includes("audio") || lowerName.includes("音频") || lowerName.includes("bgm")) {
    return "audio";
  }
  if (lowerName.includes("text") || lowerName.includes("文本")) {
    return "text";
  }
  // 默认为图片
  return "image";
}

