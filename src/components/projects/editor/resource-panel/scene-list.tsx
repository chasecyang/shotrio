"use client";

import { Scene, SceneImage } from "@/types/project";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEditor } from "../editor-context";
import { Map, ImageIcon, Plus, Sparkles, Loader2, Info } from "lucide-react";
import { SceneDialog } from "./scene-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SceneExtractionBanner } from "./scene-extraction-banner";
import { SceneExtractionDialog } from "./scene-extraction-dialog";
import { getProjectDetail } from "@/lib/actions/project";
import { startSceneExtraction } from "@/lib/actions/scene";
import { toast } from "sonner";
import { useState } from "react";

interface SceneListProps {
  scenes: (Scene & { images?: SceneImage[] })[];
  projectId: string;
}

export function SceneList({ scenes, projectId }: SceneListProps) {
  const { state, selectResource, updateProject } = useEditor();
  const { selectedResource, project } = state;
  const [isStartingExtraction, setIsStartingExtraction] = useState(false);
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false);
  const [extractionJobId, setExtractionJobId] = useState<string>("");

  const handleSceneClick = (scene: Scene) => {
    selectResource({ type: "scene", id: scene.id });
  };

  const handleSuccess = async () => {
    // 重新加载项目数据
    const updatedProject = await getProjectDetail(projectId);
    if (updatedProject) {
      updateProject(updatedProject);
    }
  };

  const handleStartExtraction = async () => {
    setIsStartingExtraction(true);
    try {
      const result = await startSceneExtraction(projectId);
      if (result.success && result.jobId) {
        toast.success("场景提取任务已提交");
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

  const handleOpenPreview = (jobId: string) => {
    setExtractionJobId(jobId);
    setExtractionDialogOpen(true);
  };

  const handleImportSuccess = async () => {
    await handleSuccess();
  };

  const hasEpisodes = project?.episodes && project.episodes.length > 0;

  if (scenes.length === 0) {
    return (
      <div className="space-y-3">
        {/* 提取任务横幅 */}
        {hasEpisodes && (
          <SceneExtractionBanner
            projectId={projectId}
            onOpenPreview={handleOpenPreview}
            compact
          />
        )}
        
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Map className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground mb-3">暂无场景</p>
          
          {/* 没有剧集时的提示 */}
          {!hasEpisodes && (
            <Alert className="mb-4 text-left">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">提示：</span>
                    先在&ldquo;剧本&rdquo;标签中添加剧集内容，即可使用 AI 智能提取场景功能
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {hasEpisodes && (
            <p className="text-xs text-muted-foreground mb-4">
              从剧本提取或手动创建
            </p>
          )}
          
          <div className="space-y-2">
            {hasEpisodes && (
              <Button 
                onClick={handleStartExtraction}
                disabled={isStartingExtraction}
                size="sm"
                variant="outline"
                className="w-full bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20"
              >
                {isStartingExtraction ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-2" />
                    从剧本提取
                  </>
                )}
              </Button>
            )}
            <SceneDialog 
              projectId={projectId}
              onSuccess={handleSuccess}
              trigger={
                <Button size="sm" variant="outline" className="w-full">
                  <Plus className="w-3.5 h-3.5 mr-2" />
                  {hasEpisodes ? "手动创建" : "创建场景"}
                </Button>
              }
            />
          </div>
        </div>

        {/* 提取对话框 */}
        {extractionJobId && (
          <SceneExtractionDialog
            projectId={projectId}
            jobId={extractionJobId}
            open={extractionDialogOpen}
            onOpenChange={setExtractionDialogOpen}
            existingScenes={scenes.map(s => ({ id: s.id, name: s.name }))}
            onImportSuccess={handleImportSuccess}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 提取任务横幅 */}
      {hasEpisodes && (
        <SceneExtractionBanner
          projectId={projectId}
          onOpenPreview={handleOpenPreview}
          compact
        />
      )}

      {/* 操作按钮组 */}
      <div className="flex gap-2">
        {hasEpisodes && (
          <Button 
            onClick={handleStartExtraction}
            disabled={isStartingExtraction}
            size="sm"
            variant="outline"
            className="flex-1 bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20"
          >
            {isStartingExtraction ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                提交中
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                提取
              </>
            )}
          </Button>
        )}
        <SceneDialog 
          projectId={projectId}
          onSuccess={handleSuccess}
          trigger={
            <Button variant="outline" className="flex-1" size="sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              创建
            </Button>
          }
        />
      </div>
      
      {/* 场景列表 */}
      {scenes.map((scene) => {
        const isSelected = selectedResource?.type === "scene" && selectedResource.id === scene.id;
        const hasImages = scene.images && scene.images.length > 0;
        const previewImage = scene.images?.[0];

        return (
          <button
            key={scene.id}
            onClick={() => handleSceneClick(scene)}
            className={cn(
              "w-full text-left p-3 rounded-lg border transition-all",
              "hover:border-primary/40 hover:bg-accent/50",
              isSelected && "border-primary bg-primary/5 ring-2 ring-primary ring-offset-1"
            )}
          >
            <div className="flex items-start gap-3">
              {/* 场景预览图 */}
              <div className="w-16 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {previewImage?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewImage.imageUrl}
                    alt={scene.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium truncate">{scene.name}</h4>
                  {hasImages && (
                    <Badge variant="secondary" className="text-xs">
                      {scene.images!.length}
                    </Badge>
                  )}
                </div>
                {scene.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {scene.description}
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}

      {/* 提取对话框 */}
      {extractionJobId && (
        <SceneExtractionDialog
          projectId={projectId}
          jobId={extractionJobId}
          open={extractionDialogOpen}
          onOpenChange={setExtractionDialogOpen}
          existingScenes={scenes.map(s => ({ id: s.id, name: s.name }))}
          onImportSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}

