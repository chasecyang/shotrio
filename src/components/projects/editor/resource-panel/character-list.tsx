"use client";

import { Character, CharacterImage } from "@/types/project";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEditor } from "../editor-context";
import { Users, Plus, Sparkles, Loader2, FileText, Info } from "lucide-react";
import { CharacterDialog } from "../../characters/character-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CharacterExtractionBanner } from "../../characters/character-extraction-banner";
import { CharacterExtractionDialog } from "../../characters/character-extraction-dialog";
import { getProjectDetail } from "@/lib/actions/project";
import { startCharacterExtraction } from "@/lib/actions/character";
import { toast } from "sonner";
import { useState } from "react";

interface CharacterListProps {
  characters: (Character & { images: CharacterImage[] })[];
  projectId: string;
}

export function CharacterList({ characters, projectId }: CharacterListProps) {
  const { state, selectResource, updateProject } = useEditor();
  const { selectedResource, project } = state;
  const [isStartingExtraction, setIsStartingExtraction] = useState(false);
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false);
  const [extractionJobId, setExtractionJobId] = useState<string>("");

  const handleCharacterClick = (character: Character) => {
    selectResource({ type: "character", id: character.id });
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
      const result = await startCharacterExtraction(projectId);
      
      if (result.success) {
        toast.success("已提交角色提取任务");
      } else {
        toast.error(result.error || "提交任务失败");
      }
    } catch (error) {
      toast.error("提交任务失败");
      console.error("启动角色提取失败:", error);
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

  if (characters.length === 0) {
    return (
      <div className="space-y-3">
        {/* 提取任务横幅 */}
        {hasEpisodes && (
          <CharacterExtractionBanner
            projectId={projectId}
            onOpenPreview={handleOpenPreview}
            compact
          />
        )}
        
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground mb-3">暂无角色</p>
          
          {/* 没有剧集时的提示 */}
          {!hasEpisodes && (
            <Alert className="mb-4 text-left">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">提示：</span>
                    先在"剧本"标签中添加剧集内容，即可使用 AI 智能提取角色功能
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
            <CharacterDialog 
              projectId={projectId}
              onSuccess={handleSuccess}
              trigger={
                <Button size="sm" variant="outline" className="w-full">
                  <Plus className="w-3.5 h-3.5 mr-2" />
                  {hasEpisodes ? "手动创建" : "创建角色"}
                </Button>
              }
            />
          </div>
        </div>

        {/* 提取对话框 */}
        {extractionJobId && (
          <CharacterExtractionDialog
            open={extractionDialogOpen}
            onOpenChange={setExtractionDialogOpen}
            projectId={projectId}
            jobId={extractionJobId}
            existingCharacters={characters.map(c => ({ id: c.id, name: c.name }))}
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
        <CharacterExtractionBanner
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
        <CharacterDialog 
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
      
      {/* 角色列表 */}
      {characters.map((character) => {
        const isSelected = selectedResource?.type === "character" && selectedResource.id === character.id;
        const primaryImage = character.images.find((img) => img.isPrimary) || character.images[0];

        return (
          <button
            key={character.id}
            onClick={() => handleCharacterClick(character)}
            className={cn(
              "w-full text-left p-3 rounded-lg border transition-all",
              "hover:border-primary/40 hover:bg-accent/50",
              isSelected && "border-primary bg-primary/5 ring-2 ring-primary ring-offset-1"
            )}
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={primaryImage?.imageUrl || undefined} />
                <AvatarFallback className="text-sm">
                  {character.name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium truncate">{character.name}</h4>
                  {character.images.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {character.images.length}
                    </Badge>
                  )}
                </div>
                {character.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {character.description}
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}

      {/* 提取对话框 */}
      {extractionJobId && (
        <CharacterExtractionDialog
          open={extractionDialogOpen}
          onOpenChange={setExtractionDialogOpen}
          projectId={projectId}
          jobId={extractionJobId}
          existingCharacters={characters.map(c => ({ id: c.id, name: c.name }))}
          onImportSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}

