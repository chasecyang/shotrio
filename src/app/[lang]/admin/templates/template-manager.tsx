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

const categoryOptions = [
  { value: "romance", label: "爱情" },
  { value: "suspense", label: "悬疑" },
  { value: "comedy", label: "喜剧" },
  { value: "action", label: "动作" },
  { value: "fantasy", label: "奇幻" },
];

export function TemplateManager({ templates, projects }: TemplateManagerProps) {
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

  const handleAddTemplate = async () => {
    if (!selectedProject) {
      toast.error("请选择一个项目");
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
        toast.success("模板添加成功");
        setIsAddDialogOpen(false);
        setSelectedProject("");
        setFormData({ videoUrl: "", thumbnail: "", category: "", order: 0 });
        router.refresh();
      } else {
        toast.error(result.error || "添加失败");
      }
    } catch {
      toast.error("添加失败");
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
        toast.success("模板更新成功");
        setIsEditDialogOpen(false);
        setSelectedTemplate(null);
        router.refresh();
      } else {
        toast.error(result.error || "更新失败");
      }
    } catch {
      toast.error("更新失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveTemplate = async (projectId: string) => {
    if (!confirm("确定要取消此项目的模板标记吗？")) return;

    setIsLoading(true);
    try {
      const result = await unmarkProjectAsTemplate(projectId);
      if (result.success) {
        toast.success("已取消模板标记");
        router.refresh();
      } else {
        toast.error(result.error || "操作失败");
      }
    } catch {
      toast.error("操作失败");
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
          共 {templates.length} 个模板项目
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          添加模板
        </Button>
      </div>

      {/* 模板列表 */}
      <Card>
        <CardHeader>
          <CardTitle>模板项目列表</CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无模板项目，点击"添加模板"将项目标记为模板
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目名称</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>素材数</TableHead>
                  <TableHead>视频</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead className="text-right">操作</TableHead>
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
                          {categoryOptions.find((c) => c.value === template.category)
                            ?.label || template.category}
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
            <DialogTitle>添加模板项目</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>选择项目</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="选择一个项目" />
                </SelectTrigger>
                <SelectContent>
                  {availableProjects.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      没有可用的项目
                    </div>
                  ) : (
                    availableProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex flex-col">
                          <span>{project.title} ({project.assetCount} 个素材)</span>
                          <span className="text-xs text-muted-foreground">
                            {project.ownerName || project.ownerEmail || "未知用户"}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>展示视频 URL</Label>
              <Input
                value={formData.videoUrl}
                onChange={(e) =>
                  setFormData({ ...formData, videoUrl: e.target.value })
                }
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label>缩略图 URL</Label>
              <Input
                value={formData.thumbnail}
                onChange={(e) =>
                  setFormData({ ...formData, thumbnail: e.target.value })
                }
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label>分类</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>排序权重（越大越靠前）</Label>
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
              取消
            </Button>
            <Button onClick={handleAddTemplate} disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑模板对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑模板信息</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>展示视频 URL</Label>
              <Input
                value={formData.videoUrl}
                onChange={(e) =>
                  setFormData({ ...formData, videoUrl: e.target.value })
                }
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label>缩略图 URL</Label>
              <Input
                value={formData.thumbnail}
                onChange={(e) =>
                  setFormData({ ...formData, thumbnail: e.target.value })
                }
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label>分类</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>排序权重（越大越靠前）</Label>
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
              取消
            </Button>
            <Button onClick={handleEditTemplate} disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
