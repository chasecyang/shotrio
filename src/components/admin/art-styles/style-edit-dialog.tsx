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
import { useTranslations } from "next-intl";

interface StyleEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  style: ArtStyle | null; // null表示创建新风格
}

export function StyleEditDialog({ open, onOpenChange, style }: StyleEditDialogProps) {
  const router = useRouter();
  const t = useTranslations("admin.artStyles.editor");
  const tCommon = useTranslations("common");
  const tToast = useTranslations("toasts");
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
      toast.error(t("nameRequired"));
      return;
    }

    if (!formData.prompt.trim()) {
      toast.error(t("promptRequired"));
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
          toast.success(tToast("success.styleUpdated"));
          router.refresh();
          onOpenChange(false);
        } else {
          toast.error(result.error || tToast("error.updateFailed"));
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
          toast.success(tToast("success.styleCreated"));
          router.refresh();
          onOpenChange(false);
        } else {
          toast.error(result.error || tToast("error.creationFailed"));
        }
      }
    } catch (error) {
      toast.error(tToast("error.operationFailed"));
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
            <DialogTitle>{style ? t("editTitle") : t("createTitle")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 显示现有预览图 */}
            {style?.previewImage && (
              <div className="space-y-2">
                <Label>{t("currentPreview")}</Label>
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
              <Label htmlFor="name">{t("nameZh")} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("nameZhPlaceholder")}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nameEn">{t("nameEn")}</Label>
              <Input
                id="nameEn"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                placeholder={t("nameEnPlaceholder")}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("description")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("descriptionPlaceholder")}
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
                placeholder={t("promptPlaceholder")}
                rows={4}
                disabled={loading}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {t("promptHint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">{t("tags")}</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder={t("tagsPlaceholder")}
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {style ? tCommon("save") : t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看大图对话框 */}
      <Dialog open={!!viewingImage} onOpenChange={(open) => !open && setViewingImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("previewImage")}</DialogTitle>
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

