import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // 添加 pathname 到请求 headers 中，用于判断是否是对话页面
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  
  // 创建新的请求对象，包含更新后的 headers
  const modifiedRequest = new NextRequest(request, {
    headers: requestHeaders,
  });
  
  // 执行 next-intl 的中间件
  const response = intlMiddleware(modifiedRequest);
  
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

