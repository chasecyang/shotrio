"use client";

import { useState } from "react";
import { Scene, SceneImage, ProjectDetail } from "@/types/project";
import { Card } from "@/components/ui/card";
import { Map, MoreHorizontal, Pencil, Trash2, MapPin, Sparkles, Plus, Film } from "lucide-react";
import { SceneDialog } from "./scene-dialog";
import { SceneDetailSheet } from "./scene-detail-sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteScene } from "@/lib/actions/scene";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ScenesSectionProps {
  project: ProjectDetail;
}

export function ScenesSection({ project }: ScenesSectionProps) {
  const [selectedScene, setSelectedScene] = useState<(Scene & { images: SceneImage[] }) | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const scenes = project.scenes || [];

  const handleCardClick = (scene: Scene & { images: SceneImage[] }) => {
    setSelectedScene(scene);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">场景管理</h2>
          <p className="text-sm text-muted-foreground">
            创建场景并生成视角参考图，为分镜生成提供统一的视觉基础。
          </p>
        </div>
        <div className="flex gap-2">
          <SceneDialog projectId={project.id} />
        </div>
      </div>

      {scenes.length === 0 ? (
        <EmptyState projectId={project.id} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {scenes.map((scene) => (
            <SceneCard 
              key={scene.id} 
              scene={scene} 
              projectId={project.id}
              onClick={() => handleCardClick(scene)}
            />
          ))}
        </div>
      )}

      {selectedScene && (
        <SceneDetailSheet
          projectId={project.id}
          scene={selectedScene}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      )}
    </div>
  );
}

function EmptyState({ projectId }: { projectId: string }) {
  return (
    <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed min-h-[400px] bg-gradient-to-b from-muted/20 to-background">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 animate-in fade-in zoom-in duration-500">
        <Map className="w-10 h-10 text-primary" />
      </div>
      <h3 className="text-2xl font-semibold mb-3">开始创建场景</h3>
      <p className="text-muted-foreground mb-8 max-w-md leading-relaxed">
        为你的作品添加拍摄场景，描述场景的环境和氛围，然后生成多角度参考图。
        这将为后续的分镜生成提供统一的视觉风格。
      </p>
      
      <div className="mb-8">
        <SceneDialog 
          projectId={projectId}
          trigger={
            <Button size="lg">
              <Plus className="w-5 h-5 mr-2" />
              创建第一个场景
            </Button>
          }
        />
      </div>

      {/* Quick Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl text-left">
        <div className="p-4 rounded-lg bg-muted/30 border">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mb-2 text-sm font-bold text-primary">
            1
          </div>
          <h4 className="font-medium mb-1 text-sm">创建场景</h4>
          <p className="text-xs text-muted-foreground">
            输入场景名称和环境描述
          </p>
        </div>
        <div className="p-4 rounded-lg bg-muted/30 border">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mb-2 text-sm font-bold text-primary">
            2
          </div>
          <h4 className="font-medium mb-1 text-sm">生成视角</h4>
          <p className="text-xs text-muted-foreground">
            AI 生成多个角度的场景参考图
          </p>
        </div>
        <div className="p-4 rounded-lg bg-muted/30 border">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mb-2 text-sm font-bold text-primary">
            3
          </div>
          <h4 className="font-medium mb-1 text-sm">应用到分镜</h4>
          <p className="text-xs text-muted-foreground">
            在分镜中关联场景统一风格
          </p>
        </div>
      </div>
    </Card>
  );
}

function SceneCard({ 
  scene, 
  projectId,
  onClick,
}: { 
  scene: Scene & { images: SceneImage[] }; 
  projectId: string;
  onClick: () => void;
}) {
  const primaryImage = scene.images.find(img => img.isPrimary && img.imageUrl) 
    || scene.images.find(img => img.imageUrl);
  
  const hasImages = scene.images.length > 0;
  const hasGeneratedImages = scene.images.some(img => img.imageUrl);
  const pendingImagesCount = scene.images.filter(img => !img.imageUrl).length;
  const hasBasicInfo = scene.description || scene.location || scene.timeOfDay;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`确定要删除场景「${scene.name}」吗？`)) {
      try {
        await deleteScene(projectId, scene.id);
        toast.success("场景已删除");
      } catch {
        toast.error("删除失败");
      }
    }
  };

  return (
    <Card 
      className="group relative overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all duration-300"
      onClick={onClick}
    >
      <div className="aspect-[3/4] bg-muted relative overflow-hidden">
        {primaryImage?.imageUrl ? (
          <img 
            src={primaryImage.imageUrl} 
            alt={scene.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted/50 to-muted text-muted-foreground">
            <MapPin className="w-16 h-16 opacity-20 mb-3" />
            <p className="text-xs opacity-60">
              {hasImages ? "点击生成视角图片" : "点击生成场景"}
            </p>
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        
        {/* Status Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {!hasBasicInfo && (
            <Badge variant="secondary" className="text-[10px] bg-orange-500/90 text-white border-0">
              未完善设定
            </Badge>
          )}
          {hasImages && !hasGeneratedImages && (
            <Badge variant="secondary" className="text-[10px] bg-blue-500/90 text-white border-0 animate-pulse">
              <Sparkles className="w-3 h-3 mr-1" />
              待生成图片
            </Badge>
          )}
          {hasGeneratedImages && pendingImagesCount > 0 && (
            <Badge variant="secondary" className="text-[10px] bg-amber-500/90 text-white border-0">
              {pendingImagesCount} 个待生成
            </Badge>
          )}
          {!hasImages && hasBasicInfo && (
            <Badge variant="secondary" className="text-[10px] bg-indigo-500/90 text-white border-0">
              待创建视角
            </Badge>
          )}
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <h3 className="font-semibold text-lg truncate mb-1">{scene.name}</h3>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-white/80">
              {scene.location && (
                <span className="px-2 py-0.5 rounded bg-white/20 backdrop-blur-sm">
                  {scene.location}
                </span>
              )}
              {scene.timeOfDay && (
                <span className="px-2 py-0.5 rounded bg-white/20 backdrop-blur-sm">
                  {scene.timeOfDay}
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-white/70 mt-2">
            {hasImages ? (
              hasGeneratedImages 
                ? `${scene.images.filter(img => img.imageUrl).length}/${scene.images.length} 个视角`
                : `${scene.images.length} 个视角待生成`
            ) : "暂无视角"}
          </p>
        </div>
      </div>

      {/* Action Menu */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="secondary" 
              size="icon" 
              className="h-8 w-8 rounded-full bg-white/90 hover:bg-white shadow-lg backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4 text-black" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }}>
              <Pencil className="mr-2 h-4 w-4" /> 管理场景
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> 删除场景
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
