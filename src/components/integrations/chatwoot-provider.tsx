'use client';

import { ChatwootWidget } from './chatwoot-widget';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}

interface ChatwootProviderProps {
  user?: User | null;
}

/**
 * 定义不显示 Chatwoot 的路径
 * 这些页面不适合展示客服聊天组件
 */
const EXCLUDED_PATHS = [
  '/login',           // 登录页
  '/register',        // 注册页
  '/admin',           // 管理后台
  '/privacy',         // 隐私政策
  '/terms',           // 用户协议
];

/**
 * 检查当前路径是否应该显示浮动的 Chatwoot 按钮
 */
function shouldShowFloatingButton(pathname: string): boolean {
  // 移除语言前缀（如 /zh、/en）
  const pathWithoutLocale = pathname.replace(/^\/(zh|en)/, '');

  // 检查是否匹配排除路径
  const isExcludedPath = EXCLUDED_PATHS.some(excludedPath =>
    pathWithoutLocale.startsWith(excludedPath)
  );

  if (isExcludedPath) {
    return false;
  }

  // projects 页面使用 header 中的按钮，不显示浮动按钮
  if (pathWithoutLocale.startsWith('/projects')) {
    return false;
  }

  return true;
}

/**
 * 检查当前路径是否应该加载 Chatwoot
 */
function shouldLoadChatwoot(pathname: string): boolean {
  // 移除语言前缀（如 /zh、/en）
  const pathWithoutLocale = pathname.replace(/^\/(zh|en)/, '');
  
  // 检查是否匹配排除路径
  const isExcludedPath = EXCLUDED_PATHS.some(excludedPath => 
    pathWithoutLocale.startsWith(excludedPath)
  );
  
  return !isExcludedPath;
}

export function ChatwootProvider({ user }: ChatwootProviderProps) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 只在客户端渲染
  if (!mounted) {
    return null;
  }

  // 检查是否应该在当前页面加载 Chatwoot
  if (!shouldLoadChatwoot(pathname)) {
    return null;
  }

  const websiteToken = process.env.NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN;
  const baseUrl = process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL;

  // 如果没有配置 Chatwoot，不渲染组件
  if (!websiteToken || !baseUrl) {
    return null;
  }

  // 判断是否显示浮动按钮
  const showFloating = shouldShowFloatingButton(pathname);

  return (
    <ChatwootWidget
      websiteToken={websiteToken}
      baseUrl={baseUrl}
      showFloatingButton={showFloating}
      user={
        user
          ? {
              identifier: user.id,
              email: user.email,
              name: user.name,
              avatarUrl: user.image ?? undefined,
            }
          : undefined
      }
      customAttributes={{
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV,
      }}
    />
  );
}

