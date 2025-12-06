import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // 支持的所有语言
  locales: ['zh', 'en'],

  // 默认语言
  defaultLocale: 'zh',

  // 使用 URL 路径前缀策略
  localePrefix: 'always',
  
  // 启用语言检测（根据 Cookie、Accept-Language 自动检测）
  localeDetection: true,
});

// 创建类型安全的导航助手
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);

