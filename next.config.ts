import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// 解析环境变量中的域名
const r2Domain = process.env.R2_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_R2_DOMAIN;
const r2Hostname = r2Domain ? r2Domain.replace(/^https?:\/\//, '').split('/')[0] : null;

const remotePatterns = [
  // 保留默认的 R2 开发域名以防万一
  {
    protocol: 'https' as const,
    hostname: 'pub-*.r2.dev',
  },
  {
    protocol: 'https' as const,
    hostname: '**.r2.cloudflarestorage.com',
  },
  // 添加 s3.shotrio.com 支持
  {
    protocol: 'https' as const,
    hostname: 's3.shotrio.com',
  }
];

if (r2Hostname) {
  remotePatterns.unshift({
    protocol: 'https' as const,
    hostname: r2Hostname,
  });
}

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns,
    unoptimized: process.env.NODE_ENV !== "production",
  },
  experimental:{
    serverActions:{
      bodySizeLimit: '10mb',
    }
  },
  async redirects() {
    return [
      {
        source: '/:lang/register',
        destination: '/:lang?login=true',
        permanent: true,
      },
      {
        source: '/:lang/login',
        destination: '/:lang?login=true',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
