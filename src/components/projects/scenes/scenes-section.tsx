"use client";

import { ProjectDetail } from "@/types/project";
import { Card } from "@/components/ui/card";
import { Map, Plus } from "lucide-react";
import { SceneDialog } from "./scene-dialog";
import { Button } from "@/components/ui/button";
import { SceneCard } from "./scene-card";

interface ScenesSectionProps {
  project: ProjectDetail;
}

export function ScenesSection({ project }: ScenesSectionProps) {
  const scenes = project.scenes || [];

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {scenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              projectId={project.id}
            />
          ))}
        </div>
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
