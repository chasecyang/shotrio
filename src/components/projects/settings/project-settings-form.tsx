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

interface ProjectSettingsFormProps {
  project: ProjectDetail;
  userId: string;
}

export function ProjectSettingsForm({ project, userId }: ProjectSettingsFormProps) {
  const router = useRouter();
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
        toast.error("加载风格列表失败");
      } finally {
        setLoadingStyles(false);
      }
    }
    loadStyles();
  }, [userId]);

  async function handleSave() {
    if (!formData.title.trim()) {
      toast.error("请输入项目名称");
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
        toast.success("保存成功");
        // 刷新页面数据
        router.refresh();
      } else {
        toast.error(result.error || "保存失败");
      }
    } catch (error) {
      toast.error("保存失败，请重试");
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
        toast.success("项目已删除");
        router.push("/projects");
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      toast.error("删除失败，请重试");
      console.error(error);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">项目设置</h1>
        <p className="text-sm text-muted-foreground mt-1">
          管理项目的基本信息和配置
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">项目名称 *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              disabled={loading}
              placeholder="例如：霸道总裁爱上我"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">项目简介</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              disabled={loading}
              placeholder="简单描述这个项目..."
              rows={3}
            />
          </div>

          {/* 美术风格选择 */}
          <div className="space-y-3" id="style">
            <Label>美术风格</Label>
            <p className="text-xs text-muted-foreground">
              选择一个预设风格或自定义风格，应用于项目中所有角色和场景的图片生成
            </p>
            
            {loadingStyles ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Tabs defaultValue="preset" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preset">预设风格</TabsTrigger>
                  <TabsTrigger value="custom">自定义风格</TabsTrigger>
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
                      placeholder="例如：Cyberpunk style, neon lights, 8k resolution, cinematic lighting"
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      输入自定义的英文风格描述词，用于 AI 生成图像时的全局风格提示
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
              保存设置
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-destructive">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-destructive">危险区域</h3>
            <p className="text-sm text-muted-foreground mt-1">
              删除项目后，所有相关数据将永久丢失，无法恢复
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!deleting && <Trash2 className="mr-2 h-4 w-4" />}
                删除项目
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除项目？</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作无法撤销。项目「{project.title}」及其所有数据（包括分集、角色、分镜等）将被永久删除。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>
    </div>
  );
}

