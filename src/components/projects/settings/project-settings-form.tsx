"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectDetail } from "@/types/project";
import { ArtStyle } from "@/types/art-style";
import { updateProject, deleteProject } from "@/lib/actions/project";
import { getSystemArtStyles, getUserArtStyles } from "@/lib/actions/art-style/queries";
import { StyleSelector } from "./style-selector";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";
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

interface ProjectSettingsFormProps {
  project: ProjectDetail;
  userId: string;
}

export function ProjectSettingsForm({ project, userId }: ProjectSettingsFormProps) {
  const router = useRouter();
  const t = useTranslations("projects.settings");
  const tCommon = useTranslations("common");
  const tToasts = useTranslations("toasts");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [systemStyles, setSystemStyles] = useState<ArtStyle[]>([]);
  const [loadingStyles, setLoadingStyles] = useState(true);
  
  const [formData, setFormData] = useState({
    title: project.title,
    description: project.description || "",
    styleId: project.styleId || null,
    stylePrompt: project.stylePrompt || "",
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
  }, [userId]);

  async function handleSave() {
    if (!formData.title.trim()) {
      toast.error(tToasts("error.enterProjectName"));
      return;
    }

    setLoading(true);
    try {
      const result = await updateProject(project.id, {
        title: formData.title,
        description: formData.description || null,
        styleId: formData.styleId,
        stylePrompt: formData.stylePrompt || null,
      });

      if (result.success) {
        toast.success(tToasts("success.settingsSaved"));
        // 刷新页面数据
        router.refresh();
      } else {
        toast.error(result.error || tToasts("error.saveFailed"));
      }
    } catch (error) {
      toast.error(tToasts("error.saveFailed"));
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("description")}
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">{t("projectName")}</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              disabled={loading}
              placeholder={t("projectNamePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("projectDescription")}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              disabled={loading}
              placeholder={t("projectDescriptionPlaceholder")}
              rows={3}
            />
          </div>

          {/* 美术风格选择 */}
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
              <Tabs defaultValue="preset" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preset">{t("presetStyle")}</TabsTrigger>
                  <TabsTrigger value="custom">{t("customStyle")}</TabsTrigger>
                </TabsList>
                
                <TabsContent value="preset" className="mt-4">
                  <StyleSelector
                    styles={systemStyles}
                    selectedStyleId={formData.styleId}
                    onSelect={(styleId) => setFormData({ ...formData, styleId, stylePrompt: "" })}
                  />
                </TabsContent>
                
                <TabsContent value="custom" className="mt-4">
                  <div className="space-y-2">
                    <Textarea
                      value={formData.stylePrompt}
                      onChange={(e) =>
                        setFormData({ ...formData, stylePrompt: e.target.value, styleId: null })
                      }
                      disabled={loading}
                      placeholder={t("customStylePlaceholder")}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("customStyleHint")}
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {!loading && <Save className="mr-2 h-4 w-4" />}
              {t("saveButton")}
            </Button>
          </div>
        </div>
      </Card>

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

