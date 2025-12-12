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
  ArrowLeft,
  Play,
  Pause,
  Settings,
  MoreVertical,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { useEditor } from "./editor-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { BackgroundTasks } from "../layout/background-tasks";

interface EditorHeaderProps {
  projectId: string;
  projectTitle: string;
  userId: string;
}

export function EditorHeader({
  projectId,
  projectTitle,
  userId,
}: EditorHeaderProps) {
  const { state, setPlaying } = useEditor();
  const { timeline } = state;
  const isMobile = useIsMobile();

  // 移动端头部
  if (isMobile) {
    return (
      <header className="h-12 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-3 gap-2 shrink-0">
        {/* 返回按钮 */}
        <Button variant="ghost" size="icon" asChild className="shrink-0 h-8 w-8">
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        {/* 项目名 */}
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">{projectTitle}</h1>
        </div>

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
            <DropdownMenuItem asChild>
              <Link href={`/projects/${projectId}/settings`}>
                <Settings className="h-4 w-4 mr-2" />
                设置
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
    );
  }

  // 桌面端头部
  return (
    <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 gap-4 shrink-0">
      {/* 左侧：返回 + 项目名 */}
      <div className="flex items-center gap-3 min-w-0">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold truncate">{projectTitle}</h1>
          <p className="text-xs text-muted-foreground">编辑器</p>
        </div>
      </div>

      <div className="flex-1" />

      {/* 右侧：播放控制 + 后台任务 + 设置 */}
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

        {/* 后台任务 */}
        <BackgroundTasks />

        {/* 设置 */}
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href={`/projects/${projectId}/settings`}>
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
