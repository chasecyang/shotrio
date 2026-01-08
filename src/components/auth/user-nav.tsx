"use client";

import { useRouter } from "@/i18n/routing";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { getImageSrc } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Shield, Languages, Check, ChevronsUpDown, Wallet } from "lucide-react";
import { useTranslations, useLocale } from 'next-intl';
import { routing } from "@/i18n/routing";
import { toast } from "sonner";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";

type Language = typeof routing.locales[number];

interface UserNavProps {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    role?: string;
  };
  variant?: "default" | "sidebar";
}

// Sidebar 变体的内部实现（需要在 SidebarProvider 内使用）
function UserNavSidebar({ user }: { user: UserNavProps['user'] }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();
  const currentLocale = useLocale();
  const sidebar = useSidebar();

  const interfaceLanguageNames: Record<string, string> = {
    zh: '🇨🇳 中文',
    en: '🇺🇸 English',
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/');
    router.refresh();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const switchInterfaceLanguage = (newLang: Language) => {
    const pathWithoutLang = pathname.replace(/^\/[^\/]+/, '') || '/';
    router.push(pathWithoutLang, { locale: newLang });
    toast.success(t('language.languageUpdated'));
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={getImageSrc(user.image)} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={sidebar.isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={getImageSrc(user.image)} alt={user.name} />
                  <AvatarFallback className="rounded-lg">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/credits')} className="cursor-pointer">
                <Wallet className="mr-2 h-4 w-4" />
                <span>{t('nav.creditsCenter')}</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <Languages className="mr-2 h-4 w-4" />
                  <span>{t('language.interfaceLanguage')}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {routing.locales.map((locale) => (
                    <DropdownMenuItem
                      key={locale}
                      onClick={() => switchInterfaceLanguage(locale as Language)}
                      className="cursor-pointer"
                    >
                      <Check className={`mr-2 h-4 w-4 ${currentLocale === locale ? 'opacity-100' : 'opacity-0'}`} />
                      <span>{interfaceLanguageNames[locale]}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>

            {user.role === "admin" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push('/admin')} className="cursor-pointer">
                    <Shield className="mr-2 h-4 w-4" />
                    <span>{t('admin.title')}</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </>
            )}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t('nav.logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// 默认变体的实现（不需要 SidebarProvider）
function UserNavDefault({ user }: { user: UserNavProps['user'] }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();
  const currentLocale = useLocale();

  const interfaceLanguageNames: Record<string, string> = {
    zh: '🇨🇳 中文',
    en: '🇺🇸 English',
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/');
    router.refresh();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const switchInterfaceLanguage = (newLang: Language) => {
    const pathWithoutLang = pathname.replace(/^\/[^\/]+/, '') || '/';
    router.push(pathWithoutLang, { locale: newLang });
    toast.success(t('language.languageUpdated'));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage src={getImageSrc(user.image)} alt={user.name} />
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/credits')} className="cursor-pointer">
            <Wallet className="mr-2 h-4 w-4" />
            <span>{t('nav.creditsCenter')}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <Languages className="mr-2 h-4 w-4" />
              <span>{t('language.interfaceLanguage')}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {routing.locales.map((locale) => (
                <DropdownMenuItem
                  key={locale}
                  onClick={() => switchInterfaceLanguage(locale as Language)}
                  className="cursor-pointer"
                >
                  <Check className={`mr-2 h-4 w-4 ${currentLocale === locale ? 'opacity-100' : 'opacity-0'}`} />
                  <span>{interfaceLanguageNames[locale]}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        {user.role === "admin" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/admin')} className="cursor-pointer">
                <Shield className="mr-2 h-4 w-4" />
                <span>{t('admin.title')}</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t('nav.logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// 主组件：根据 variant 选择渲染哪个实现
export function UserNav({ user, variant = "default" }: UserNavProps) {
  if (variant === "sidebar") {
    return <UserNavSidebar user={user} />;
  }
  
  return <UserNavDefault user={user} />;
}

