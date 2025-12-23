"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Settings } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useRouter } from "next/navigation";
import { useEditor } from "./editor-context";
import { BackgroundTasks } from "../layout/background-tasks";
import { ProjectSelector } from "../layout/project-selector";
import { UserNav } from "@/components/auth/user-nav";
import { EditorCreditsButton } from "./editor-credits-button";
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
  const router = useRouter();
  const { dispatch } = useEditor();

  const handleSettingsClick = () => {
    // 更新 URL 参数
    router.push(`/projects/${projectId}/editor?view=settings`);
    // 同时更新 editor state
    dispatch({
      type: "SELECT_RESOURCE",
      payload: { type: "settings", id: projectId },
    });
  };

  return (
    <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 gap-4 shrink-0">
      {/* 左侧：Logo + 项目切换 */}
      <div className="flex items-center gap-3 min-w-0">
        <Link 
          href="/projects" 
          className="flex items-center hover:opacity-70 transition-opacity shrink-0"
        >
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Shotrio
          </span>
        </Link>
        <Separator orientation="vertical" className="h-6" />
        <ProjectSelector 
          projects={projects}
          currentProjectId={projectId}
        />
      </div>

      <div className="flex-1" />

      {/* 右侧：积分 + 后台任务 + 设置 + 用户菜单 */}
      <div className="flex items-center gap-2">
        {/* 积分显示 */}
        <EditorCreditsButton />

        <Separator orientation="vertical" className="h-6" />

        {/* 后台任务 */}
        <BackgroundTasks />

        {/* 设置 */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={handleSettingsClick}
        >
          <Settings className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* 用户菜单 */}
        <UserNav user={user} variant="default" />
      </div>
    </header>
  );
}
