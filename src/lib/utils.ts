import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 获取图片资源的完整访问路径
 * 直接返回 URL，或者将 Key 转换为公开访问的 URL
 */
export function getImageSrc(keyOrUrl: string | null | undefined): string {
  if (!keyOrUrl) return "";
  
  // 如果已经是 URL (http/https) 或者是本地路径 (/)
  if (keyOrUrl.startsWith("http") || keyOrUrl.startsWith("/")) {
    return keyOrUrl;
  }
  
  // 否则视为 R2 Key，拼接公开域名
  // 注意：这里需要和后端 R2_PUBLIC_DOMAIN 保持一致的逻辑
  // 由于这是在客户端执行，我们尽量依赖后端返回完整 URL
  // 如果必须在前端拼接，可以使用环境变量 NEXT_PUBLIC_R2_DOMAIN
  
  const domain = process.env.NEXT_PUBLIC_R2_DOMAIN || process.env.NEXT_PUBLIC_R2_PUBLIC_BUCKET_URL;
  
  if (domain) {
    const cleanDomain = domain.replace(/\/$/, '').replace(/^https?:\/\//, '');
    return `https://${cleanDomain}/${keyOrUrl}`;
  }

  // 如果没有配置环境变量，这是个兜底，但在生产环境应该避免
  return keyOrUrl;
}
