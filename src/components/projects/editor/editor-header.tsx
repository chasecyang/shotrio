"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Settings } from "lucide-react";
import { Link } from "@/i18n/routing";
import { BackgroundTasks } from "../layout/background-tasks";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ProjectSelector } from "../layout/project-selector";
import { UserNav } from "@/components/auth/user-nav";
import { EditorCreditsButton } from "./editor-credits-button";
import { BetaBadge } from "@/components/ui/beta-badge";
import { ProjectSettingsDialog } from "./project-settings-dialog";
import type { EditorProject, EditorUser } from "./editor-types";

interface EditorHeaderProps {
  projectId: string;
  projects: EditorProject[];
  user: EditorUser;
}

export function EditorHeader({
  projectId,
  projects,
  user,
}: EditorHeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 gap-4 shrink-0">
      {/* 左侧：Logo + 项目切换 + 项目设置 */}
      <div className="flex items-center gap-3 min-w-0">
        <Link 
          href="/projects" 
          className="flex items-center gap-2 hover:opacity-70 transition-opacity shrink-0"
        >
          <span className="text-xl font-bold">
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Shot</span>
            <span className="text-primary/40">Rio</span>
          </span>
          <BetaBadge variant="minimal" />
        </Link>
        <Separator orientation="vertical" className="h-6" />
        <ProjectSelector 
          projects={projects}
          currentProjectId={projectId}
        />
        
        {/* 项目设置按钮 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>项目设置</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex-1" />

      {/* 右侧：积分 + 后台任务 + 用户菜单 */}
      <div className="flex items-center gap-2">
        {/* 积分显示 */}
        <EditorCreditsButton />

        <Separator orientation="vertical" className="h-6" />

        {/* 后台任务 */}
        <BackgroundTasks />

        <Separator orientation="vertical" className="h-6" />

        <ThemeToggle />

        {/* 用户菜单 */}
        <UserNav user={user} variant="default" />
      </div>

      {/* 项目设置弹窗 */}
      <ProjectSettingsDialog 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen} 
      />
    </header>
  );
}
