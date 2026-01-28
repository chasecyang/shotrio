"use client";

import { Link, usePathname } from "@/i18n/routing";
import {
  Palette,
  LayoutDashboard,
  Home,
  Ticket,
  FileVideo,
  Image,
  Wrench,
  // Users,
  // Settings,
  // FileText,
  // ImageIcon
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useTranslations } from "next-intl";

interface NavItem {
  titleKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  {
    titleKey: "dashboard.title",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    titleKey: "artStyles.sidebarTitle",
    href: "/admin/art-styles",
    icon: Palette,
  },
  {
    titleKey: "templates.sidebarTitle",
    href: "/admin/templates",
    icon: FileVideo,
  },
  {
    titleKey: "examples.sidebarTitle",
    href: "/admin/examples",
    icon: Image,
  },
  {
    titleKey: "redeemCodes.title",
    href: "/admin/redeem-codes",
    icon: Ticket,
  },
  {
    titleKey: "maintenance.sidebarTitle",
    href: "/admin/maintenance",
    icon: Wrench,
  },
  // 未来可以添加更多管理功能
  // {
  //   title: "用户管理",
  //   href: "/admin/users",
  //   icon: Users,
  // },
  // {
  //   title: "项目管理",
  //   href: "/admin/projects",
  //   icon: FileText,
  // },
  // {
  //   title: "资源管理",
  //   href: "/admin/assets",
  //   icon: ImageIcon,
  // },
  // {
  //   title: "系统设置",
  //   href: "/admin/settings",
  //   icon: Settings,
  // },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const t = useTranslations("admin");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60">
                  <LayoutDashboard className="size-4 text-primary-foreground" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Admin</span>
                  <span className="text-xs text-muted-foreground">{t("subtitle")}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== "/admin" && pathname?.startsWith(item.href));
                const title = t(item.titleKey as never);
                
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={title}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.badge && (
                      <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t("backToMain")}>
              <Link href="/">
                <Home />
                <span>{t("backToMain")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

