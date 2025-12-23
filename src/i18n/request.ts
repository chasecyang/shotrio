import { getRequestConfig } from 'next-intl/server';

// Supported languages
export const locales = ['en', 'zh'] as const;
export type Locale = (typeof locales)[number];

// Default language
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async ({ requestLocale }) => {
  // This usually corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure the incoming locale is valid
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

