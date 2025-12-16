"use client";

import { useState, useEffect } from "react";
import { ArtStyle } from "@/types/art-style";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ZoomIn } from "lucide-react";
import { createSystemArtStyle, updateArtStyleAdmin } from "@/lib/actions/admin/art-style-admin";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface StyleEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  style: ArtStyle | null; // null表示创建新风格
}

export function StyleEditDialog({ open, onOpenChange, style }: StyleEditDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    nameEn: "",
    description: "",
    prompt: "",
    tags: "",
  });

  // 当style变化时更新表单数据
  useEffect(() => {
    if (style) {
      setFormData({
        name: style.name,
        nameEn: style.nameEn || "",
        description: style.description || "",
        prompt: style.prompt,
        tags: style.tags?.join(", ") || "",
      });
    } else {
      // 重置表单
      setFormData({
        name: "",
        nameEn: "",
        description: "",
        prompt: "",
        tags: "",
      });
    }
  }, [style, open]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("请输入风格名称");
      return;
    }

    if (!formData.prompt.trim()) {
      toast.error("请输入Prompt");
      return;
    }

    setLoading(true);
    try {
      const tags = formData.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t);

      if (style) {
        // 更新现有风格
        const result = await updateArtStyleAdmin(style.id, {
          name: formData.name,
          nameEn: formData.nameEn || undefined,
          description: formData.description || undefined,
          prompt: formData.prompt,
          tags,
        });

        if (result.success) {
          toast.success("更新成功");
          router.refresh();
          onOpenChange(false);
        } else {
          toast.error(result.error || "更新失败");
        }
      } else {
        // 创建新风格
        const result = await createSystemArtStyle({
          name: formData.name,
          nameEn: formData.nameEn || undefined,
          description: formData.description || undefined,
          prompt: formData.prompt,
          tags,
        });

        if (result.success) {
          toast.success("创建成功");
          router.refresh();
          onOpenChange(false);
        } else {
          toast.error(result.error || "创建失败");
        }
      }
    } catch (error) {
      toast.error("操作失败");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{style ? "编辑风格" : "创建风格"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 显示现有预览图 */}
            {style?.previewImage && (
              <div className="space-y-2">
                <Label>当前预览图</Label>
                <div 
                  className="relative w-full aspect-video cursor-pointer group"
                  onClick={() => setViewingImage(style.previewImage!)}
                >
                  <Image
                    src={style.previewImage}
                    alt={style.name}
                    fill
                    className="object-cover rounded-lg border"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                    <ZoomIn className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">风格名称（中文）*</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：现代动漫"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nameEn">风格名称（英文）</Label>
              <Input
                id="nameEn"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                placeholder="例如：Modern Anime"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="简要描述这个风格的特点..."
                rows={2}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt *</Label>
              <Textarea
                id="prompt"
                value={formData.prompt}
                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                placeholder="例如：modern anime style, vibrant colors, cel shading, high quality, 8k"
                rows={4}
                disabled={loading}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                用于 AI 生成图像的英文提示词
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">标签</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="用逗号分隔，例如：动漫, 日系, 二次元"
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {style ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看大图对话框 */}
      <Dialog open={!!viewingImage} onOpenChange={(open) => !open && setViewingImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>预览图</DialogTitle>
          </DialogHeader>
          {viewingImage && (
            <div className="relative w-full aspect-video">
              <Image
                src={viewingImage}
                alt="Preview"
                fill
                className="object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

