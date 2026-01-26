"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProjectDetail } from "@/types/project";
import { ArtStyle } from "@/types/art-style";
import { updateProject, deleteProject } from "@/lib/actions/project";
import { getSystemArtStyles, getUserArtStyles } from "@/lib/actions/art-style/queries";
import { StyleTemplateSelector } from "./style-template-selector";
import { toast } from "sonner";
import { Loader2, Trash2, Check, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTranslations } from "next-intl";
import { useAutoSave, SaveStatus } from "@/hooks/use-auto-save";

interface ProjectSettingsFormProps {
  project: ProjectDetail;
  userId: string;
}

export function ProjectSettingsForm({ project, userId }: ProjectSettingsFormProps) {
  const router = useRouter();
  const t = useTranslations("projects.settings");
  const tToasts = useTranslations("toasts");
  const [deleting, setDeleting] = useState(false);
  const [systemStyles, setSystemStyles] = useState<ArtStyle[]>([]);
  const [loadingStyles, setLoadingStyles] = useState(true);
  
  const [formData, setFormData] = useState({
    title: project.title,
    description: project.description || "",
    stylePrompt: project.stylePrompt || "",
  });

  const [originalData] = useState({
    title: project.title,
    description: project.description || "",
    stylePrompt: project.stylePrompt || "",
  });

  // 自动保存处理
  const handleAutoSave = useCallback(async (data: typeof formData) => {
    if (!data.title.trim()) {
      return { success: false, error: t("errors.titleRequired") };
    }
    const result = await updateProject(project.id, {
      title: data.title,
      description: data.description || null,
      stylePrompt: data.stylePrompt || null,
    });
    return result;
  }, [project.id, t]);

  const { saveStatus } = useAutoSave({
    data: formData,
    originalData,
    onSave: handleAutoSave,
    onSaveSuccess: () => {
      window.dispatchEvent(new CustomEvent("project-changed"));
    },
    delay: 1000,
  });

  // 加载风格列表
  useEffect(() => {
    async function loadStyles() {
      setLoadingStyles(true);
      try {
        const [system] = await Promise.all([
          getSystemArtStyles(),
          getUserArtStyles(userId),
        ]);
        setSystemStyles(system);
      } catch (error) {
        console.error("加载风格列表失败:", error);
        toast.error(tToasts("error.loadStylesFailed"));
      } finally {
        setLoadingStyles(false);
      }
    }
    loadStyles();
  }, [userId, tToasts]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const result = await deleteProject(project.id);

      if (result.success) {
        toast.success(tToasts("success.projectDeleted"));
        router.push("/projects");
      } else {
        toast.error(result.error || tToasts("error.deleteFailed"));
      }
    } catch (error) {
      toast.error(tToasts("error.deleteFailed"));
      console.error(error);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* 项目名称 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="title">{t("projectName")}</Label>
          <SaveStatusIndicator status={saveStatus} />
        </div>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) =>
            setFormData({ ...formData, title: e.target.value })
          }
          placeholder={t("projectNamePlaceholder")}
        />
      </div>

      {/* 项目描述 */}
      <div className="space-y-2">
        <Label htmlFor="description">{t("projectDescription")}</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder={t("projectDescriptionPlaceholder")}
          rows={3}
        />
      </div>

      {/* 美术风格设置 */}
      <div className="space-y-3" id="style">
        <Label>{t("artStyle")}</Label>
        <p className="text-xs text-muted-foreground">
          {t("artStyleDescription")}
        </p>

        {loadingStyles ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* 主要文本输入区 */}
            <div className="space-y-2">
              <Textarea
                value={formData.stylePrompt}
                onChange={(e) =>
                  setFormData({ ...formData, stylePrompt: e.target.value })
                }
                placeholder={t("stylePromptPlaceholder")}
                rows={4}
                className="font-mono text-sm"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("stylePromptHint")}</span>
                <span>{t("characterCount", { count: formData.stylePrompt?.length || 0 })}</span>
              </div>
            </div>

            {/* 快速模板区 */}
            <StyleTemplateSelector
              styles={systemStyles}
              currentPrompt={formData.stylePrompt}
              onSelect={(stylePrompt) => setFormData({ ...formData, stylePrompt })}
            />
          </>
        )}
      </div>

      <Card className="p-6 border-destructive">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-destructive">{t("dangerZone")}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t("dangerZoneDescription")}
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!deleting && <Trash2 className="mr-2 h-4 w-4" />}
                {t("deleteButton")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("deleteConfirmDescription", { title: project.title })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("deleteCancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t("deleteConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>
    </div>
  );
}

// 保存状态指示器组件 - 紧凑的内联图标
function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  
  return (
    <div className="inline-flex items-center">
      {status === "saving" && (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}
      {status === "saved" && (
        <Check className="h-3.5 w-3.5 text-green-500" />
      )}
      {status === "error" && (
        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
      )}
    </div>
  );
}

