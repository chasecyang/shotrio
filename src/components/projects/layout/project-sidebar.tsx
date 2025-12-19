"use client";

import { useEffect, useState } from "react";
import { Settings, PenTool } from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ProjectSelector } from "./project-selector";
import { UserNav } from "@/components/auth/user-nav";

interface Project {
  id: string;
  title: string;
  description?: string | null;
}

interface ProjectSidebarProps {
  projects: Project[];
  currentProject?: {
    id: string;
    title: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    role?: string;
  };
}

export function ProjectSidebar({ projects, currentProject, user }: ProjectSidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const t = useTranslations('projects.nav');
  
  // 从路由参数中获取当前项目ID
  const projectIdFromRoute = params.id as string | undefined;
  
  // 使用路由中的项目ID或传入的项目ID
  const currentProjectId = projectIdFromRoute || currentProject?.id;
  
  const isActive = (path: string) => pathname === path;

  const navigation = currentProjectId
    ? [
        {
          name: "编辑器",
          href: `/projects/${currentProjectId}/editor`,
          icon: PenTool,
        },
        {
          name: t('settings'),
          href: `/projects/${currentProjectId}/settings`,
          icon: Settings,
        },
      ]
    : [];

  return (
    <Sidebar variant="inset">
      {/* Header */}
      <SidebarHeader className="h-16 border-b border-border">
        <div className="flex items-center justify-start h-full px-4">
          <Link 
            href="/projects" 
            className="flex items-center hover:opacity-70 transition-opacity"
          >
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Cineqo
            </span>
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* 项目选择器 */}
        <SidebarGroup>
          <SidebarGroupContent>
            <ProjectSelector 
              projects={projects}
              currentProjectId={currentProjectId}
            />
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 主导航 */}
        {currentProjectId && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigation.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer - 用户菜单 */}
      <SidebarFooter className="mt-auto border-t border-border">
        <UserNav user={user} variant="sidebar" />
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  );
}

