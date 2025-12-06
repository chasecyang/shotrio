import { getRequestConfig } from 'next-intl/server';

// 支持的语言
export const locales = ['zh', 'en'] as const;
export type Locale = (typeof locales)[number];

// 默认语言
export const defaultLocale: Locale = 'zh';

export default getRequestConfig(async ({ requestLocale }) => {
  // 这通常对应于 `[locale]` 段
  let locale = await requestLocale;

  // 确保传入的 locale 是有效的
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

