"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Pause,
  Settings,
  MoreVertical,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { useRouter } from "next/navigation";
import { useEditor } from "./editor-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { BackgroundTasks } from "../layout/background-tasks";
import { ProjectSelector } from "../layout/project-selector";
import { UserNav } from "@/components/auth/user-nav";
import { EditorCreditsButton } from "./editor-credits-button";
import type { EditorProject, EditorUser } from "./editor-types";

interface EditorHeaderProps {
  projectId: string;
  projectTitle: string;
  userId: string;
  projects: EditorProject[];
  user: EditorUser;
}

export function EditorHeader({
  projectId,
  projectTitle,
  projects,
  user,
}: EditorHeaderProps) {
  const router = useRouter();
  const { state, setPlaying, dispatch } = useEditor();
  const { timeline } = state;
  const isMobile = useIsMobile();

  const handleSettingsClick = () => {
    // 更新 URL 参数
    router.push(`/projects/${projectId}/editor?view=settings`);
    // 同时更新 editor state
    dispatch({
      type: "SELECT_RESOURCE",
      payload: { type: "settings", id: projectId },
    });
  };

  // 移动端头部
  if (isMobile) {
    return (
      <header className="h-12 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-3 gap-2 shrink-0">
        {/* Logo */}
        <Link 
          href="/projects" 
          className="flex items-center hover:opacity-70 transition-opacity shrink-0"
        >
          <span className="text-lg font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Cineqo
          </span>
        </Link>

        {/* 项目切换 */}
        <ProjectSelector 
          projects={projects}
          currentProjectId={projectId}
        />

        <div className="flex-1" />

        {/* 后台任务 */}
        <BackgroundTasks />

        {/* 更多操作菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleSettingsClick}>
              <Settings className="h-4 w-4 mr-2" />
              设置
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
    );
  }

  // 桌面端头部
  return (
    <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 gap-4 shrink-0">
      {/* 左侧：Logo + 项目切换 */}
      <div className="flex items-center gap-3 min-w-0">
        <Link 
          href="/projects" 
          className="flex items-center hover:opacity-70 transition-opacity shrink-0"
        >
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Cineqo
          </span>
        </Link>
        <Separator orientation="vertical" className="h-6" />
        <ProjectSelector 
          projects={projects}
          currentProjectId={projectId}
        />
      </div>

      <div className="flex-1" />

      {/* 右侧：播放控制 + 积分 + 后台任务 + 设置 + 用户菜单 */}
      <div className="flex items-center gap-2">
        {/* 播放/暂停 */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setPlaying(!timeline.isPlaying)}
        >
          {timeline.isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <Separator orientation="vertical" className="h-6" />

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
