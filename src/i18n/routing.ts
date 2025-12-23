import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // Supported languages
  locales: ['en', 'zh'],

  // Default language
  defaultLocale: 'en',

  // 使用 URL 路径前缀策略
  localePrefix: 'always',
  
  // 启用语言检测（根据 Cookie、Accept-Language 自动检测）
  localeDetection: true,
});

// 创建类型安全的导航助手
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);

