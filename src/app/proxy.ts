import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { locales, defaultLocale, type Locale } from '@/i18n/request'

function getLocale(request: NextRequest): Locale {
  // 1. 检查 Cookie 中保存的语言偏好
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale
  }

  // 2. 检查 Accept-Language header
  const acceptLanguage = request.headers.get('accept-language')
  if (acceptLanguage) {
    // 解析 Accept-Language header
    const languages = acceptLanguage
      .split(',')
      .map(lang => {
        const parts = lang.split(';')
        const locale = parts[0].trim()
        return locale
      })
    
    // 查找匹配的语言
    for (const language of languages) {
      // 完全匹配（如 zh-CN -> zh）
      const shortLang = language.split('-')[0] as Locale
      if (locales.includes(shortLang)) {
        return shortLang
      }
      // 直接匹配
      if (locales.includes(language as Locale)) {
        return language as Locale
      }
    }
  }

  // 3. 返回默认语言
  return defaultLocale
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // 检查路径是否已经包含语言前缀
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) return

  // 获取用户语言偏好
  const locale = getLocale(request)

  // 重定向到带语言前缀的路径
  request.nextUrl.pathname = `/${locale}${pathname}`
  const response = NextResponse.redirect(request.nextUrl)
  
  // 设置 Cookie 保存语言偏好（30天）
  response.cookies.set('NEXT_LOCALE', locale, {
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  
  return response
}

export const config = {
  matcher: [
    // 匹配所有路径，除了：
    // - api 路由
    // - _next/static (静态文件)
    // - _next/image (图片优化)
    // - favicon.ico, robots.txt 等静态文件
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

