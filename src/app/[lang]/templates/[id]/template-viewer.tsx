"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Copy,
  Loader2,
  Lock,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { cloneTemplateProject } from "@/lib/actions/project/clone";
import { toast } from "sonner";
import type { Project } from "@/types/project";

// 分类标签映射
const categoryLabels: Record<string, string> = {
  romance: "爱情",
  suspense: "悬疑",
  comedy: "喜剧",
  action: "动作",
  fantasy: "奇幻",
};

// 资产类型图标
const assetTypeIcons: Record<string, React.ElementType> = {
  image: ImageIcon,
  video: Video,
  text: FileText,
  audio: Music,
};

interface TemplateViewerProps {
  project: Project & {
    template: {
      videoUrl: string | null;
      thumbnail: string | null;
      category: string | null;
    };
    assets?: Array<{
      id: string;
      name: string;
      assetType: string;
      tags?: Array<{ tagValue: string }>;
    }>;
    artStyle?: {
      name: string;
      nameEn: string | null;
    } | null;
  };
}

export function TemplateViewer({ project }: TemplateViewerProps) {
  const router = useRouter();
  const [isCloning, setIsCloning] = useState(false);

  const handleClone = async () => {
    setIsCloning(true);
    try {
      const result = await cloneTemplateProject(project.id);
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

  const handleBack = () => {
    router.push("/");
  };

  // 按类型分组资产
  const assetsByType = (project.assets || []).reduce(
    (acc, asset) => {
      const type = asset.assetType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(asset);
      return acc;
    },
    {} as Record<string, typeof project.assets>
  );

  return (
    <div className="container px-4 py-8 mx-auto max-w-6xl">
      {/* 只读模式提示条 */}
      <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
        <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
          <Lock className="w-5 h-5" />
          <span className="font-medium">只读模式 - 这是一个示例模板项目</span>
        </div>
        <Button onClick={handleClone} disabled={isCloning} className="gap-2">
          {isCloning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          复制此项目并开始编辑
        </Button>
      </div>

      {/* 返回按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBack}
        className="mb-6 gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        返回首页
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左侧：视频预览 */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            {project.template.videoUrl ? (
              <video
                src={project.template.videoUrl}
                controls
                className="w-full aspect-video"
                poster={project.template.thumbnail || undefined}
              />
            ) : project.template.thumbnail ? (
              <img
                src={project.template.thumbnail}
                alt={project.title}
                className="w-full aspect-video object-cover"
              />
            ) : (
              <div className="w-full aspect-video bg-muted flex items-center justify-center text-muted-foreground">
                暂无预览
              </div>
            )}
          </Card>

          {/* 项目信息 */}
          <div className="mt-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h1 className="text-3xl font-bold">{project.title}</h1>
              {project.template.category && (
                <Badge variant="secondary" className="text-sm">
                  {categoryLabels[project.template.category] ||
                    project.template.category}
                </Badge>
              )}
            </div>
            {project.description && (
              <p className="text-muted-foreground text-lg leading-relaxed">
                {project.description}
              </p>
            )}
          </div>
        </div>

        {/* 右侧：项目详情 */}
        <div className="space-y-6">
          {/* 美术风格 */}
          {project.artStyle && (
            <Card className="p-4">
              <h3 className="font-semibold mb-2">美术风格</h3>
              <p className="text-primary font-medium">{project.artStyle.name}</p>
              {project.artStyle.nameEn && (
                <p className="text-sm text-muted-foreground">
                  {project.artStyle.nameEn}
                </p>
              )}
            </Card>
          )}

          {/* 素材统计 */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">项目素材</h3>
            <div className="space-y-3">
              {Object.entries(assetsByType).map(([type, assets]) => {
                const Icon = assetTypeIcons[type] || FileText;
                const typeLabels: Record<string, string> = {
                  image: "图片",
                  video: "视频",
                  text: "文本",
                  audio: "音频",
                };
                return (
                  <div
                    key={type}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Icon className="w-4 h-4" />
                      <span>{typeLabels[type] || type}</span>
                    </div>
                    <span className="font-medium">{assets?.length || 0} 个</span>
                  </div>
                );
              })}
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between font-medium">
              <span>总计</span>
              <span>{project.assets?.length || 0} 个素材</span>
            </div>
          </Card>

          {/* 素材列表预览 */}
          {project.assets && project.assets.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-4">素材列表</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {project.assets.slice(0, 20).map((asset) => {
                  const Icon = assetTypeIcons[asset.assetType] || FileText;
                  return (
                    <div
                      key={asset.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 text-sm"
                    >
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{asset.name}</span>
                      {asset.tags && asset.tags.length > 0 && (
                        <Badge variant="outline" className="ml-auto text-xs shrink-0">
                          {asset.tags[0].tagValue}
                        </Badge>
                      )}
                    </div>
                  );
                })}
                {project.assets.length > 20 && (
                  <p className="text-center text-sm text-muted-foreground pt-2">
                    还有 {project.assets.length - 20} 个素材...
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* 复制按钮（底部固定） */}
          <Button
            onClick={handleClone}
            disabled={isCloning}
            className="w-full gap-2"
            size="lg"
          >
            {isCloning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            复制此项目并开始创作
          </Button>
        </div>
      </div>
    </div>
  );
}
