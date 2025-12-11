"use client";

import { useState } from "react";
import { ProjectDetail } from "@/types/project";
import { Card } from "@/components/ui/card";
import { Map, Plus, Sparkles, Loader2 } from "lucide-react";
import { SceneDialog } from "./scene-dialog";
import { Button } from "@/components/ui/button";
import { SceneCard } from "./scene-card";
import { SceneExtractionBanner } from "./scene-extraction-banner";
import { SceneExtractionDialog } from "./scene-extraction-dialog";
import { startSceneExtraction } from "@/lib/actions/scene";
import { toast } from "sonner";
import { StyleBadge } from "../shared/style-badge";

interface ScenesSectionProps {
  project: ProjectDetail;
}

export function ScenesSection({ project }: ScenesSectionProps) {
  const scenes = project.scenes || [];
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false);
  const [extractionJobId, setExtractionJobId] = useState<string>("");
  const [isStartingExtraction, setIsStartingExtraction] = useState(false);
  const [recentlyImportedJobId, setRecentlyImportedJobId] = useState<string | null>(null);

  const handleOpenPreview = (jobId: string) => {
    setExtractionJobId(jobId);
    setExtractionDialogOpen(true);
  };

  const handleImportSuccess = () => {
    setRecentlyImportedJobId(extractionJobId);
  };

  // 处理开始场景提取
  const handleStartExtraction = async () => {
    setIsStartingExtraction(true);
    try {
      const result = await startSceneExtraction(project.id);
      if (result.success && result.jobId) {
        toast.success("场景提取任务已提交，AI 正在分析剧本...");
      } else {
        toast.error(result.error || "提交失败");
      }
    } catch (error) {
      console.error("启动场景提取失败:", error);
      toast.error("提交失败，请稍后重试");
    } finally {
      setIsStartingExtraction(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight">场景管理</h2>
            <StyleBadge project={project} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            创建场景并生成视角参考图，为分镜生成提供统一的视觉基础。
          </p>
        </div>
        <div className="flex gap-2">
          {project.episodes.length > 0 && (
            <Button 
              onClick={handleStartExtraction}
              disabled={isStartingExtraction}
              variant="outline"
              className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20 hover:border-primary/40"
            >
              {isStartingExtraction ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  <Map className="w-4 h-4 mr-1" />
                  从剧本提取
                </>
              )}
            </Button>
          )}
          <SceneDialog projectId={project.id} />
        </div>
      </div>

      {/* 场景提取横幅 */}
      <SceneExtractionBanner 
        projectId={project.id}
        onOpenPreview={handleOpenPreview}
        recentlyImportedJobId={recentlyImportedJobId}
      />

      {scenes.length === 0 ? (
        <EmptyState 
          projectId={project.id} 
          hasEpisodes={project.episodes.length > 0}
          onStartExtraction={handleStartExtraction}
          isStartingExtraction={isStartingExtraction}
        />
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

      {/* 场景提取对话框 */}
      <SceneExtractionDialog
        projectId={project.id}
        jobId={extractionJobId}
        open={extractionDialogOpen}
        onOpenChange={setExtractionDialogOpen}
        existingScenes={scenes.map(s => ({ id: s.id, name: s.name }))}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
}

interface EmptyStateProps {
  projectId: string;
  hasEpisodes: boolean;
  onStartExtraction: () => void;
  isStartingExtraction: boolean;
}

function EmptyState({ 
  projectId, 
  hasEpisodes, 
  onStartExtraction,
  isStartingExtraction 
}: EmptyStateProps) {
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
      
      <div className="mb-8 flex gap-3">
        {hasEpisodes && (
          <Button 
            onClick={onStartExtraction}
            disabled={isStartingExtraction}
            size="lg"
            className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90"
          >
            {isStartingExtraction ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                提交中...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                从剧本提取场景
              </>
            )}
          </Button>
        )}
        <SceneDialog 
          projectId={projectId}
          trigger={
            <Button variant={hasEpisodes ? "outline" : "default"} size="lg">
              <Plus className="w-5 h-5 mr-2" />
              手动创建场景
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
