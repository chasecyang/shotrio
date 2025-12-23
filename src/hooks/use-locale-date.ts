"use client";

import { useLocale } from "next-intl";
import { enUS, zhCN, type Locale } from "date-fns/locale";

/**
 * Hook to get the appropriate date-fns locale based on current language
 * @returns date-fns Locale object
 */
export function useLocaleDate(): Locale {
  const locale = useLocale();
  
  switch (locale) {
    case "zh":
      return zhCN;
    case "en":
      return enUS;
    default:
      return enUS; // Default to English
  }
}

