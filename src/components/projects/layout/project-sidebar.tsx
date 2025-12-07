"use client";

import { FileText, Users, Settings, Clapperboard, ListTodo } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectSelector } from "./project-selector";
import { UserNav } from "@/components/auth/user-nav";
import { TaskCenter } from "@/components/tasks/task-center";
import { useTaskSubscription } from "@/hooks/use-task-subscription";

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
  shotCount?: number;
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
  const { jobs: activeJobs } = useTaskSubscription();

  const isActive = (path: string) => pathname === path;
  const activeTaskCount = activeJobs.length;

  const navigation = currentProject
    ? [
        {
          name: t('scripts'),
          href: `/projects/${currentProject.id}/scripts`,
          icon: FileText,
          badge: currentProject.episodes.length,
        },
        {
          name: t('storyboard'),
          href: `/projects/${currentProject.id}/storyboard`,
          icon: Clapperboard,
          badge: currentProject.shotCount,
        },
        {
          name: t('characters'),
          href: `/projects/${currentProject.id}/characters`,
          icon: Users,
          badge: currentProject.characters.length,
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
                        {item.badge !== undefined && item.badge > 0 && (
                          <Badge 
                            variant="outline"
                            className="ml-auto"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* 任务中心 */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <TaskCenter 
              trigger={
                <Button 
                  variant="ghost" 
                  className="w-full justify-start px-2 h-9"
                >
                  <ListTodo className="mr-2 h-4 w-4" />
                  <span>任务中心</span>
                  {activeTaskCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="ml-auto h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]"
                    >
                      {activeTaskCount}
                    </Badge>
                  )}
                </Button>
              }
            />
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      {/* Footer - 用户菜单 */}
      <SidebarFooter className="mt-auto border-t border-border">
        <UserNav user={user} variant="sidebar" />
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  );
}

