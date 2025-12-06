"use client"

import { usePathname } from 'next/navigation'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Languages, Check, ChevronDown } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { routing } from '@/i18n/routing'

const languageNames: Record<string, string> = {
  zh: '中文',
  en: 'English',
}

const languageFlags: Record<string, string> = {
  zh: '🇨🇳',
  en: '🇺🇸',
}

export function LanguageSwitcher() {
  const pathname = usePathname()
  const router = useRouter()
  const currentLocale = useLocale()
  const t = useTranslations('language')

  const switchLanguage = (newLang: string) => {
    const pathWithoutLang = pathname.replace(/^\/[^\/]+/, '') || '/'
    router.push(pathWithoutLang, { locale: newLang })
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 px-2 sm:px-3"
              >
                <Languages className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">{languageNames[currentLocale]}</span>
                <ChevronDown className="h-3 w-3 opacity-50 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-neutral-500">
                {t('changeInterfaceLanguage')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {routing.locales.map((locale) => (
                <DropdownMenuItem
                  key={locale}
                  onClick={() => switchLanguage(locale)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{languageFlags[locale]}</span>
                    <span>{languageNames[locale]}</span>
                  </span>
                  {currentLocale === locale && (
                    <Check className="h-4 w-4 text-neutral-900" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t('interfaceLanguageTooltip')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
