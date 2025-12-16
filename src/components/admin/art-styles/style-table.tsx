"use client";

import { useState } from "react";
import { ArtStyle } from "@/types/art-style";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  MoreHorizontal, 
  Sparkles, 
  Edit, 
  Trash, 
  Loader2, 
  Plus, 
  Database, 
  Eye, 
  ZoomIn,
  Trash2,
  Wand2
} from "lucide-react";
import { 
  generateStylePreview, 
  deleteArtStyleAdmin, 
  initializeArtStyles,
  batchGenerateStylePreviews,
  batchDeleteArtStyles
} from "@/lib/actions/admin/art-style-admin";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { StyleEditDialog } from "./style-edit-dialog";

interface StyleTableProps {
  styles: ArtStyle[];
}

export function StyleTable({ styles }: StyleTableProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState<string | null>(null);
  const [editingStyle, setEditingStyle] = useState<ArtStyle | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [viewingImage, setViewingImage] = useState<{ url: string; name: string } | null>(null);
  const [viewingStyle, setViewingStyle] = useState<ArtStyle | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const handleGeneratePreview = async (styleId: string) => {
    setGenerating(styleId);
    try {
      const result = await generateStylePreview(styleId);
      if (result.success) {
        toast.success("预览图生成成功");
        router.refresh();
      } else {
        toast.error(result.error || "生成失败");
      }
    } catch (error) {
      toast.error("生成失败");
      console.error(error);
    } finally {
      setGenerating(null);
    }
  };

  const handleDelete = async (styleId: string, styleName: string) => {
    if (!confirm(`确定要删除风格"${styleName}"吗？`)) {
      return;
    }

    try {
      const result = await deleteArtStyleAdmin(styleId);
      if (result.success) {
        toast.success("删除成功");
        router.refresh();
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      toast.error("删除失败");
      console.error(error);
    }
  };

  const handleInitialize = async () => {
    if (!confirm("确定要初始化美术风格吗？这将导入所有预设的系统风格。")) {
      return;
    }

    setInitializing(true);
    try {
      const result = await initializeArtStyles();
      if (result.success) {
        toast.success(`初始化完成！新创建: ${result.created} 个，已跳过: ${result.skipped} 个`);
        router.refresh();
      } else {
        toast.error(result.error || "初始化失败");
      }
    } catch (error) {
      toast.error("初始化失败");
      console.error(error);
    } finally {
      setInitializing(false);
    }
  };

  const handleToggleAll = () => {
    if (selectedIds.size === styles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(styles.map(s => s.id)));
    }
  };

  const handleToggleItem = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchGenerate = async () => {
    if (selectedIds.size === 0) {
      toast.error("请先选择要生成预览图的风格");
      return;
    }

    if (!confirm(`确定要为选中的 ${selectedIds.size} 个风格生成预览图吗？这可能需要一些时间。`)) {
      return;
    }

    setBatchGenerating(true);
    try {
      const result = await batchGenerateStylePreviews(Array.from(selectedIds));
      if (result.success) {
        toast.success(`批量生成完成！成功: ${result.successCount} 个，失败: ${result.failedCount} 个`);
        setSelectedIds(new Set());
        router.refresh();
      } else {
        toast.error(result.errors?.[0] || "批量生成失败");
      }
    } catch (error) {
      toast.error("批量生成失败");
      console.error(error);
    } finally {
      setBatchGenerating(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error("请先选择要删除的风格");
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个风格吗？此操作无法撤销。`)) {
      return;
    }

    setBatchDeleting(true);
    try {
      const result = await batchDeleteArtStyles(Array.from(selectedIds));
      if (result.success) {
        toast.success(`批量删除完成！成功: ${result.successCount} 个，失败: ${result.failedCount} 个`);
        setSelectedIds(new Set());
        router.refresh();
      } else {
        toast.error(result.errors?.[0] || "批量删除失败");
      }
    } catch (error) {
      toast.error("批量删除失败");
      console.error(error);
    } finally {
      setBatchDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                已选择 {selectedIds.size} 项
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchGenerate}
                disabled={batchGenerating || batchDeleting}
              >
                {batchGenerating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-2" />
                )}
                批量生成预览图
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchDelete}
                disabled={batchGenerating || batchDeleting}
                className="text-destructive hover:text-destructive"
              >
                {batchDeleting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                批量删除
              </Button>
            </>
          )}
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handleInitialize}
            disabled={initializing}
          >
            {initializing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Database className="w-4 h-4 mr-2" />
            )}
            初始化美术风格
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            创建风格
          </Button>
        </div>
      </div>

      {/* 表格容器 - 使用 ScrollArea 确保表格可以完整显示 */}
      <div className="border rounded-lg">
        <ScrollArea className="w-full">
          <div className="min-w-[1200px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.size === styles.length && styles.length > 0}
                      onCheckedChange={handleToggleAll}
                      aria-label="全选"
                    />
                  </TableHead>
                  <TableHead className="w-28">预览图</TableHead>
                  <TableHead className="w-40">风格名称</TableHead>
                  <TableHead className="w-80">Prompt</TableHead>
                  <TableHead className="w-60">描述</TableHead>
                  <TableHead className="w-48">标签</TableHead>
                  <TableHead className="w-24 text-center">使用次数</TableHead>
                  <TableHead className="w-32 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {styles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      暂无风格数据
                    </TableCell>
                  </TableRow>
                ) : (
                  styles.map((style) => (
                    <TableRow key={style.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(style.id)}
                          onCheckedChange={() => handleToggleItem(style.id)}
                          aria-label={`选择 ${style.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        {style.previewImage ? (
                          <div
                            className="w-20 h-14 relative group cursor-pointer"
                            onClick={() => setViewingImage({ url: style.previewImage!, name: style.name })}
                          >
                            <Image
                              src={style.previewImage}
                              alt={style.name}
                              fill
                              className="object-cover rounded border"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                              <ZoomIn className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-20 h-14 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                            无
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{style.name}</div>
                          {style.nameEn && (
                            <div className="text-xs text-muted-foreground">{style.nameEn}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ScrollArea className="h-20 w-full">
                          <div className="text-sm font-mono text-muted-foreground pr-4 whitespace-pre-wrap break-words">
                            {style.prompt}
                          </div>
                        </ScrollArea>
                      </TableCell>
                      <TableCell>
                        <ScrollArea className="h-20 w-full">
                          <p className="text-sm text-muted-foreground pr-4 whitespace-pre-wrap break-words">
                            {style.description || "-"}
                          </p>
                        </ScrollArea>
                      </TableCell>
                      <TableCell>
                        {style.tags && style.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {style.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {style.userId === null ? style.usageCount : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingStyle(style)}>
                              <Eye className="w-4 h-4 mr-2" />
                              查看详情
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleGeneratePreview(style.id)}
                              disabled={generating === style.id}
                            >
                              {generating === style.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Sparkles className="w-4 h-4 mr-2" />
                              )}
                              生成预览图
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditingStyle(style)}>
                              <Edit className="w-4 h-4 mr-2" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(style.id, style.name)}
                              className="text-destructive"
                            >
                              <Trash className="w-4 h-4 mr-2" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </div>

      {/* 编辑对话框 */}
      <StyleEditDialog
        open={!!editingStyle}
        onOpenChange={(open) => !open && setEditingStyle(null)}
        style={editingStyle}
      />

      {/* 创建对话框 */}
      <StyleEditDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        style={null}
      />

      {/* 查看大图对话框 */}
      <Dialog open={!!viewingImage} onOpenChange={(open) => !open && setViewingImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{viewingImage?.name}</DialogTitle>
          </DialogHeader>
          {viewingImage && (
            <div className="relative w-full aspect-video">
              <Image
                src={viewingImage.url}
                alt={viewingImage.name}
                fill
                className="object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 查看详情对话框 */}
      <Dialog open={!!viewingStyle} onOpenChange={(open) => !open && setViewingStyle(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>风格详情</DialogTitle>
          </DialogHeader>
          {viewingStyle && (
            <div className="space-y-6 py-4">
              {/* 预览图 */}
              {viewingStyle.previewImage && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm">预览图</h3>
                  <div 
                    className="relative w-full aspect-video cursor-pointer group"
                    onClick={() => setViewingImage({ 
                      url: viewingStyle.previewImage!, 
                      name: viewingStyle.name 
                    })}
                  >
                    <Image
                      src={viewingStyle.previewImage}
                      alt={viewingStyle.name}
                      fill
                      className="object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                      <ZoomIn className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>
              )}

              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-medium text-sm">中文名称</h3>
                  <p className="text-sm text-muted-foreground">{viewingStyle.name}</p>
                </div>
                {viewingStyle.nameEn && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm">英文名称</h3>
                    <p className="text-sm text-muted-foreground">{viewingStyle.nameEn}</p>
                  </div>
                )}
              </div>

              {/* 描述 */}
              {viewingStyle.description && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm">描述</h3>
                  <p className="text-sm text-muted-foreground">{viewingStyle.description}</p>
                </div>
              )}

              {/* Prompt */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Prompt</h3>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-mono text-foreground whitespace-pre-wrap break-words">
                    {viewingStyle.prompt}
                  </p>
                </div>
              </div>

              {/* 标签 */}
              {viewingStyle.tags && viewingStyle.tags.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm">标签</h3>
                  <div className="flex flex-wrap gap-2">
                    {viewingStyle.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 使用统计 */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-1">
                  <h3 className="font-medium text-sm">类型</h3>
                  <p className="text-sm text-muted-foreground">
                    {viewingStyle.userId === null ? "系统预设" : "用户自定义"}
                  </p>
                </div>
                {viewingStyle.userId === null && (
                  <div className="space-y-1">
                    <h3 className="font-medium text-sm">使用次数</h3>
                    <p className="text-sm text-muted-foreground">{viewingStyle.usageCount}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

