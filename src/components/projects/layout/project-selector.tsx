"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Film, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProject } from "@/lib/actions/project";
import { toast } from "sonner";

interface Project {
  id: string;
  title: string;
  description?: string | null;
}

interface ProjectSelectorProps {
  projects: Project[];
  currentProjectId?: string;
}

export function ProjectSelector({ projects, currentProjectId }: ProjectSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const params = useParams();

  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
  });

  // 优先使用路由参数中的项目ID，如果没有则使用传入的prop
  const activeProjectId = (params.id as string) || currentProjectId;
  const currentProject = projects.find((p) => p.id === activeProjectId);

  const handleSelectProject = (projectId: string) => {
    // 导航到该项目的编辑器页面
    router.push(`/projects/${projectId}/editor`);
  };

  const handleCreateProject = async () => {
    if (!newProject.title.trim()) {
      toast.error("请输入项目名称");
      return;
    }

    setCreating(true);
    try {
      const result = await createProject({
        title: newProject.title,
        description: newProject.description || undefined,
      });

      if (result.success && result.data) {
        toast.success("项目创建成功");
        setDialogOpen(false);
        setNewProject({ title: "", description: "" });
        // 导航到新项目
        router.push(`/projects/${result.data.id}/editor`);
      } else {
        toast.error(result.error || "创建失败");
      }
    } catch (error) {
      toast.error("创建失败，请重试");
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  {currentProject ? (
                    <span className="text-lg font-semibold">
                      {currentProject.title.charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <Film className="size-4" />
                  )}
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">
                    {currentProject ? currentProject.title : "选择项目"}
                  </span>
                  {currentProject?.description && (
                    <span className="text-xs truncate">{currentProject.description}</span>
                  )}
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
              align="start"
            >
              {projects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onSelect={() => handleSelectProject(project.id)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center w-full">
                    <span className="flex-1 truncate">{project.title}</span>
                    {activeProjectId === project.id && (
                      <Check className="ml-2 h-4 w-4" />
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setDialogOpen(true)}
                className="cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" />
                新建项目
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建新项目</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">项目名称 *</Label>
              <Input
                id="title"
                placeholder="例如：霸道总裁爱上我"
                value={newProject.title}
                onChange={(e) =>
                  setNewProject({ ...newProject, title: e.target.value })
                }
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">项目简介</Label>
              <Textarea
                id="description"
                placeholder="简单描述这个项目..."
                value={newProject.description}
                onChange={(e) =>
                  setNewProject({ ...newProject, description: e.target.value })
                }
                disabled={creating}
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              取消
            </Button>
            <Button onClick={handleCreateProject} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

