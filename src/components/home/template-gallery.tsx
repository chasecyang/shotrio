"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Copy, Eye, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { cloneTemplateProject } from "@/lib/actions/project/clone";
import { toast } from "sonner";
import type { TemplatePreview } from "@/lib/actions/project/template";

interface TemplateGalleryProps {
  templates: TemplatePreview[];
}

// 分类标签映射
const categoryLabels: Record<string, string> = {
  romance: "爱情",
  suspense: "悬疑",
  comedy: "喜剧",
  action: "动作",
  fantasy: "奇幻",
};

export function TemplateGallery({ templates }: TemplateGalleryProps) {
  if (templates.length === 0) {
    return null;
  }

  return (
    <section className="py-16 md:py-24">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-4xl font-bold font-heading mb-4">
            从示例开始
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            查看这些精心制作的示例项目，一键复制即可开始你的创作
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
        toast.success("项目复制成功！");
        router.push(`/projects/${result.projectId}/editor`);
      } else {
        toast.error(result.error || "复制失败");
      }
    } catch {
      toast.error("复制失败，请重试");
    } finally {
      setIsCloning(false);
    }
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
              <img
                src={template.thumbnail}
                alt={template.title}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                  isHovering ? "opacity-0" : "opacity-100"
                }`}
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
          <img
            src={template.thumbnail}
            alt={template.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            暂无预览
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
            查看项目
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
            复制并创建
          </Button>
        </div>
      </div>

      {/* 信息区域 */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-lg line-clamp-1">{template.title}</h3>
          {template.category && (
            <Badge variant="secondary" className="shrink-0">
              {categoryLabels[template.category] || template.category}
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
              风格: {template.styleName}
            </span>
          )}
          <span>{template.assetCount} 个素材</span>
        </div>
      </div>
    </Card>
  );
}
