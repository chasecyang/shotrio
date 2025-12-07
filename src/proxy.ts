import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  
  // 执行 next-intl 的中间件
  const response = intlMiddleware(request);
  
  return response;
}

export const config = {
  // 匹配所有路径，除了 api、_next、静态资源文件等
  matcher: [
    '/',
    '/(zh|en)/:path*',
    '/((?!api|_next|.*\\..*|ingest|sitemap.xml|robots.txt).*)'
  ],
};

