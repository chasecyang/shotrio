"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Copy, Eye, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { cloneTemplateProject } from "@/lib/actions/project/clone";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { TemplatePreview } from "@/lib/actions/project/template";

interface TemplateGalleryProps {
  templates: TemplatePreview[];
}

export function TemplateGallery({ templates }: TemplateGalleryProps) {
  const t = useTranslations("home.templates");

  if (templates.length === 0) {
    return null;
  }

  return (
    <section className="py-16 md:py-24">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-4xl font-bold font-heading mb-4">
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("description")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <TemplateCard key={template.projectId} template={template} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TemplateCard({ template }: { template: TemplatePreview }) {
  const t = useTranslations("home.templates");
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (videoRef.current && template.videoUrl) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const handleView = () => {
    router.push(`/templates/${template.projectId}`);
  };

  const handleClone = async () => {
    setIsCloning(true);
    try {
      const result = await cloneTemplateProject(template.projectId);
      if (result.success && result.projectId) {
        toast.success(t("cloneSuccess"));
        router.push(`/projects/${result.projectId}/editor`);
      } else {
        toast.error(result.error || t("cloneFailed"));
      }
    } catch {
      toast.error(t("cloneFailedRetry"));
    } finally {
      setIsCloning(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    const key = `categories.${category}` as const;
    return t.has(key) ? t(key) : category;
  };

  return (
    <Card
      className="group overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-primary/30"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 视频/缩略图区域 */}
      <div className="relative aspect-video bg-muted overflow-hidden">
        {template.videoUrl ? (
          <>
            {/* 缩略图（默认显示） */}
            {template.thumbnail && (
              <Image
                src={template.thumbnail}
                alt={template.title}
                fill
                className={`object-cover transition-opacity duration-300 ${
                  isHovering ? "opacity-0" : "opacity-100"
                }`}
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                quality={90}
              />
            )}
            {/* 视频（悬停播放） */}
            <video
              ref={videoRef}
              src={template.videoUrl}
              muted
              loop
              playsInline
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                isHovering ? "opacity-100" : "opacity-0"
              }`}
            />
            {/* 播放指示器 */}
            {!isHovering && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-primary">
                  <Play className="w-8 h-8 ml-1" />
                </div>
              </div>
            )}
          </>
        ) : template.thumbnail ? (
          <Image
            src={template.thumbnail}
            alt={template.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            {t("noPreview")}
          </div>
        )}

        {/* 悬停操作按钮 */}
        <div
          className={`absolute inset-0 bg-black/40 flex items-center justify-center gap-3 transition-opacity duration-300 ${
            isHovering ? "opacity-100" : "opacity-0"
          }`}
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={handleView}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            {t("viewProject")}
          </Button>
          <Button
            size="sm"
            onClick={handleClone}
            disabled={isCloning}
            className="gap-2"
          >
            {isCloning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {t("cloneAndCreate")}
          </Button>
        </div>
      </div>

      {/* 信息区域 */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-lg line-clamp-1">{template.title}</h3>
          {template.category && (
            <Badge variant="secondary" className="shrink-0">
              {getCategoryLabel(template.category)}
            </Badge>
          )}
        </div>
        {template.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {template.description}
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {template.styleName && (
            <span className="flex items-center gap-1">
              {t("style")}: {template.styleName}
            </span>
          )}
          <span>{t("assetsCount", { count: template.assetCount })}</span>
        </div>
      </div>
    </Card>
  );
}
