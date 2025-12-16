"use client";

import { Settings, PenTool } from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
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

interface Episode {
  id: string;
  title: string;
  order: number;
}

interface Project {
  id: string;
  title: string;
  description?: string | null;
}

interface ProjectDetail {
  id: string;
  title: string;
  episodes: Episode[];
  characters: Array<{ id: string }>;
}

interface ProjectSidebarProps {
  projects: Project[];
  currentProject?: ProjectDetail;
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
  const t = useTranslations('projects.nav');

  const isActive = (path: string) => pathname === path;

  const navigation = currentProject
    ? [
        {
          name: "编辑器",
          href: `/projects/${currentProject.id}/editor`,
          icon: PenTool,
        },
        {
          name: t('settings'),
          href: `/projects/${currentProject.id}/settings`,
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
              currentProjectId={currentProject?.id}
            />
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 主导航 */}
        {currentProject && (
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

