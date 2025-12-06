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
import { User, LogOut, Settings, Shield, Languages, Check, ChevronsUpDown } from "lucide-react";
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

export function UserNav({ user, variant = "default" }: UserNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();
  const currentLocale = useLocale();
  // 只在 sidebar 变体中使用 useSidebar
  const sidebar = variant === "sidebar" ? useSidebar() : null;

  const interfaceLanguageNames: Record<string, string> = {
    zh: '🇨🇳 中文',
    en: '🇺🇸 English',
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/login');
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
    // 获取当前路径，去掉语言前缀
    const pathWithoutLang = pathname.replace(/^\/[^\/]+/, '') || '/';
    
    // 使用 next-intl 的路由跳转
    router.push(pathWithoutLang, { locale: newLang });
    toast.success(t('language.languageUpdated'));
  };

  const trigger = variant === "sidebar" ? (
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
  ) : (
    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
      <Avatar className="h-10 w-10">
        <AvatarImage src={getImageSrc(user.image)} alt={user.name} />
        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
      </Avatar>
    </Button>
  );

  const contentProps = variant === "sidebar" 
    ? {
        className: "w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg",
        side: (sidebar?.isMobile ? "bottom" : "right") as "bottom" | "right",
        align: "end" as const,
        sideOffset: 4,
      }
    : {
        className: "w-56",
        align: "end" as const,
        forceMount: true as const,
      };

  const dropdownMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent {...contentProps}>
        {variant === "sidebar" && (
          <>
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
          </>
        )}
        
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/profile')} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            <span>{t('nav.profile') || 'Profile'}</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>{t('admin.settings')}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />
        
        {/* 系统界面语言切换 */}
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

  // Sidebar 模式返回完整的 SidebarMenu 结构
  if (variant === "sidebar") {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          {dropdownMenu}
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  // 默认模式直接返回 DropdownMenu
  return dropdownMenu;
}

