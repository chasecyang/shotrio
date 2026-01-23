"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Loader2, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProject } from "@/lib/actions/project";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface Project {
  id: string;
  title: string;
  description?: string | null;
}

interface ProjectSelectorProps {
  projects: Project[];
  currentProjectId?: string;
  variant?: "compact";
  currentProject?: {
    id: string;
    title: string;
    description?: string | null;
  };
}

export function ProjectSelector({ projects, currentProjectId, currentProject }: ProjectSelectorProps) {
  const t = useTranslations("editor.projectSelector");
  const tCommon = useTranslations("common");
  const tToast = useTranslations("toasts");
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
  // 优先使用从 context 传入的 currentProject，fallback 到从 projects 数组中查找
  const displayProject = currentProject || projects.find((p) => p.id === activeProjectId);

  const handleSelectProject = (projectId: string) => {
    // 导航到该项目的编辑器页面
    router.push(`/projects/${projectId}/editor`);
  };

  const handleCreateProject = async () => {
    if (!newProject.title.trim()) {
      toast.error(tToast("error.enterProjectName"));
      return;
    }

    setCreating(true);
    try {
      const result = await createProject({
        title: newProject.title,
        description: newProject.description || undefined,
      });

      if (result.success && result.data) {
        toast.success(tToast("success.projectCreated"));
        setDialogOpen(false);
        setNewProject({ title: "", description: "" });
        // 导航到新项目
        router.push(`/projects/${result.data.id}/editor`);
      } else {
        toast.error(result.error || tToast("error.projectCreationFailed"));
      }
    } catch (error) {
      toast.error(tToast("error.projectCreationFailed"));
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-10 gap-2 px-3 hover:bg-accent"
          >
            <Box className="h-4 w-4 opacity-70 shrink-0" />
            <span className="text-xs text-muted-foreground">{t("project")}</span>
            <span className="font-medium truncate max-w-[200px]">
              {displayProject ? displayProject.title : t("selectProject")}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[240px]">
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
            {t("newProject")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createNewProject")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t("projectName")}</Label>
              <Input
                id="title"
                placeholder={t("projectNamePlaceholder")}
                value={newProject.title}
                onChange={(e) =>
                  setNewProject({ ...newProject, title: e.target.value })
                }
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("projectDescription")}</Label>
              <Textarea
                id="description"
                placeholder={t("projectDescriptionPlaceholder")}
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
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleCreateProject} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

