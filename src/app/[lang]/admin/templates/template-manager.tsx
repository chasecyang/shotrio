"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Edit, Video, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  markProjectAsTemplate,
  unmarkProjectAsTemplate,
  updateTemplateInfo,
} from "@/lib/actions/admin/template-admin";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Template {
  projectId: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  thumbnail: string | null;
  category: string | null;
  order: number;
  assetCount: number;
  createdAt: Date;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  isTemplate: boolean;
  assetCount: number;
  ownerName: string | null;
  ownerEmail: string | null;
}

interface TemplateManagerProps {
  templates: Template[];
  projects: Project[];
}

const categoryKeys = ["romance", "suspense", "comedy", "action", "fantasy"] as const;

export function TemplateManager({ templates, projects }: TemplateManagerProps) {
  const t = useTranslations("admin.templates.manager");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState({
    videoUrl: "",
    thumbnail: "",
    category: "",
    order: 0,
  });

  // 可以添加为模板的项目（排除已是模板的）
  const availableProjects = projects.filter((p) => !p.isTemplate);

  const getCategoryLabel = (category: string) => {
    const key = `categories.${category}` as const;
    return t.has(key) ? t(key) : category;
  };

  const handleAddTemplate = async () => {
    if (!selectedProject) {
      toast.error(t("selectProjectPlaceholder"));
      return;
    }

    setIsLoading(true);
    try {
      const result = await markProjectAsTemplate(selectedProject, {
        videoUrl: formData.videoUrl || undefined,
        thumbnail: formData.thumbnail || undefined,
        category: formData.category || undefined,
        order: formData.order,
      });

      if (result.success) {
        toast.success(t("addSuccess"));
        setIsAddDialogOpen(false);
        setSelectedProject("");
        setFormData({ videoUrl: "", thumbnail: "", category: "", order: 0 });
        router.refresh();
      } else {
        toast.error(result.error || tCommon("error"));
      }
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTemplate = async () => {
    if (!selectedTemplate) return;

    setIsLoading(true);
    try {
      const result = await updateTemplateInfo(selectedTemplate.projectId, {
        videoUrl: formData.videoUrl || undefined,
        thumbnail: formData.thumbnail || undefined,
        category: formData.category || undefined,
        order: formData.order,
      });

      if (result.success) {
        toast.success(t("updateSuccess"));
        setIsEditDialogOpen(false);
        setSelectedTemplate(null);
        router.refresh();
      } else {
        toast.error(result.error || tCommon("error"));
      }
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveTemplate = async (projectId: string) => {
    if (!confirm(t("confirmRemove"))) return;

    setIsLoading(true);
    try {
      const result = await unmarkProjectAsTemplate(projectId);
      if (result.success) {
        toast.success(t("removeSuccess"));
        router.refresh();
      } else {
        toast.error(result.error || tCommon("error"));
      }
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({
      videoUrl: template.videoUrl || "",
      thumbnail: template.thumbnail || "",
      category: template.category || "",
      order: template.order,
    });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 操作栏 */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {t("totalCount", { count: templates.length })}
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          {t("addTemplate")}
        </Button>
      </div>

      {/* 模板列表 */}
      <Card>
        <CardHeader>
          <CardTitle>{t("templateList")}</CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("emptyState")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("projectName")}</TableHead>
                  <TableHead>{t("category")}</TableHead>
                  <TableHead>{t("assetCount")}</TableHead>
                  <TableHead>{t("video")}</TableHead>
                  <TableHead>{t("order")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.projectId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{template.title}</div>
                        {template.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-xs">
                            {template.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {template.category ? (
                        <Badge variant="secondary">
                          {getCategoryLabel(template.category)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{template.assetCount}</TableCell>
                    <TableCell>
                      {template.videoUrl ? (
                        <Video className="w-4 h-4 text-green-500" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{template.order}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(template)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTemplate(template.projectId)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 添加模板对话框 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("selectProject")}</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectProjectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {availableProjects.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      {t("noAvailableProjects")}
                    </div>
                  ) : (
                    availableProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex flex-col">
                          <span>{t("projectWithAssets", { title: project.title, count: project.assetCount })}</span>
                          <span className="text-xs text-muted-foreground">
                            {project.ownerName || project.ownerEmail || t("unknownUser")}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("videoUrl")}</Label>
              <Input
                value={formData.videoUrl}
                onChange={(e) =>
                  setFormData({ ...formData, videoUrl: e.target.value })
                }
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label>{t("thumbnailUrl")}</Label>
              <Input
                value={formData.thumbnail}
                onChange={(e) =>
                  setFormData({ ...formData, thumbnail: e.target.value })
                }
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label>{t("category")}</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {categoryKeys.map((key) => (
                    <SelectItem key={key} value={key}>
                      {getCategoryLabel(key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("orderWeight")}</Label>
              <Input
                type="number"
                value={formData.order}
                onChange={(e) =>
                  setFormData({ ...formData, order: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleAddTemplate} disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {tCommon("add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑模板对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("videoUrl")}</Label>
              <Input
                value={formData.videoUrl}
                onChange={(e) =>
                  setFormData({ ...formData, videoUrl: e.target.value })
                }
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label>{t("thumbnailUrl")}</Label>
              <Input
                value={formData.thumbnail}
                onChange={(e) =>
                  setFormData({ ...formData, thumbnail: e.target.value })
                }
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label>{t("category")}</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {categoryKeys.map((key) => (
                    <SelectItem key={key} value={key}>
                      {getCategoryLabel(key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("orderWeight")}</Label>
              <Input
                type="number"
                value={formData.order}
                onChange={(e) =>
                  setFormData({ ...formData, order: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleEditTemplate} disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
