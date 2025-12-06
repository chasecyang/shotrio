/**
 * Cloudflare R2 配置
 * 
 * R2 使用 S3 兼容的 API，因此可以使用 AWS SDK 进行操作
 */

import { S3Client } from "@aws-sdk/client-s3";

// 验证必要的环境变量
if (!process.env.R2_ACCOUNT_ID) {
  throw new Error("R2_ACCOUNT_ID 环境变量未设置");
}

if (!process.env.R2_ACCESS_KEY_ID) {
  throw new Error("R2_ACCESS_KEY_ID 环境变量未设置");
}

if (!process.env.R2_SECRET_ACCESS_KEY) {
  throw new Error("R2_SECRET_ACCESS_KEY 环境变量未设置");
}

if (!process.env.R2_BUCKET_NAME) {
  throw new Error("R2_BUCKET_NAME 环境变量未设置");
}

// R2 配置
export const R2_CONFIG = {
  accountId: process.env.R2_ACCOUNT_ID!,
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  bucketName: process.env.R2_BUCKET_NAME!,
  publicDomain: process.env.R2_PUBLIC_DOMAIN, // 可选：自定义域名
} as const;

// 创建 S3 客户端实例
export const r2Client = new S3Client({
  region: "auto", // R2 使用 'auto' 作为 region
  endpoint: `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey,
  },
});

/**
 * 获取文件的公开访问 URL (如果配置了公开访问)
 * 
 * @param key - 文件的 key
 * @returns 公开访问的 URL 或 null
 */
export function getPublicUrl(key: string): string | null {
  // 1. 如果配置了自定义域名（推荐方式）
  if (R2_CONFIG.publicDomain) {
    // 移除域名末尾的斜杠（如果有）
    const domain = R2_CONFIG.publicDomain.replace(/\/$/, '');
    return `https://${domain}/${key}`;
  }
  
  // 2. 如果配置了 R2 公开桶 URL
  if (process.env.R2_PUBLIC_BUCKET_URL) {
    const bucketUrl = process.env.R2_PUBLIC_BUCKET_URL.replace(/\/$/, '');
    return `${bucketUrl}/${key}`;
  }
  
  return null;
}

