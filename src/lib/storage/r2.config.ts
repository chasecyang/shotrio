/**
 * Cloudflare R2 配置
 * 
 * R2 使用 S3 兼容的 API，因此可以使用 AWS SDK 进行操作
 */

import { S3Client } from "@aws-sdk/client-s3";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

function requiredEnv(name: string, displayName = name): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${displayName} 环境变量未设置`);
  }
  return value;
}

let cachedConfig: R2Config | null = null;
let cachedClient: S3Client | null = null;

export function getR2Config(): R2Config {
  if (cachedConfig) return cachedConfig;

  cachedConfig = {
    accountId: requiredEnv("R2_ACCOUNT_ID"),
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    bucketName: requiredEnv("R2_BUCKET_NAME"),
  };

  return cachedConfig;
}

export function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;

  const config = getR2Config();
  cachedClient = new S3Client({
    region: "auto", // R2 使用 'auto' 作为 region
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return cachedClient;
}

/**
 * 获取文件的公开访问 URL (如果配置了公开访问)
 * 
 * @param key - 文件的 key
 * @returns 公开访问的 URL 或 null
 */
export function getPublicUrl(key: string): string | null {
  // 1. 如果配置了自定义域名（推荐方式）
  if (process.env.R2_PUBLIC_DOMAIN) {
    // 移除域名末尾的斜杠（如果有）
    const domain = process.env.R2_PUBLIC_DOMAIN.replace(/\/$/, "");
    return `https://${domain}/${key}`;
  }
  
  // 2. 如果配置了 R2 公开桶 URL
  if (process.env.R2_PUBLIC_BUCKET_URL) {
    const bucketUrl = process.env.R2_PUBLIC_BUCKET_URL.replace(/\/$/, "");
    return `${bucketUrl}/${key}`;
  }
  
  return null;
}
