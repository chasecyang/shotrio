"use client";

import { useState, useEffect } from "react";
import { ProjectDetail } from "@/types/project";
import { Card } from "@/components/ui/card";
import { Users, Sparkles, Plus, Loader2 } from "lucide-react";
import { CharacterDialog } from "./character-dialog";
import { CharacterExtractionDialog } from "./character-extraction-dialog";
import { CharacterExtractionBanner } from "./character-extraction-banner";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";
import { CharacterCard } from "./character-card";
import { startCharacterExtraction } from "@/lib/actions/character";
import { toast } from "sonner";
import { StyleBadge } from "../shared/style-badge";

interface CharactersSectionProps {
  project: ProjectDetail;
}

export function CharactersSection({ project }: CharactersSectionProps) {
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewJobId, setPreviewJobId] = useState<string>("");
  const [isStartingExtraction, setIsStartingExtraction] = useState(false);
  const [highlightedCharacters, setHighlightedCharacters] = useState<Set<string>>(new Set());
  const [recentlyImportedJobId, setRecentlyImportedJobId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // 检查是否有新导入的角色需要高亮
  useEffect(() => {
    const fromExtraction = searchParams.get('fromExtraction');
    if (fromExtraction === 'true' && project.characters.length > 0) {
      // 高亮最近更新的角色（按updatedAt排序，取前N个）
      const sortedChars = [...project.characters].sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      
      // 假设最近5分钟内更新的都是新导入的
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const recentChars = sortedChars.filter(char => 
        new Date(char.updatedAt).getTime() > fiveMinutesAgo
      );
      
      if (recentChars.length > 0) {
        setHighlightedCharacters(new Set(recentChars.map(c => c.id)));
        
        // 3秒后移除高亮
        setTimeout(() => {
          setHighlightedCharacters(new Set());
        }, 3000);
      }
    }
  }, [searchParams, project.characters]);

  // 处理点击"从剧本提取"按钮
  const handleStartExtraction = async () => {
    setIsStartingExtraction(true);
    try {
      const result = await startCharacterExtraction(project.id);
      
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

  // 处理打开预览对话框
  const handleOpenPreview = (jobId: string) => {
    setPreviewJobId(jobId);
    setPreviewDialogOpen(true);
  };

  const handleImportSuccess = () => {
    setRecentlyImportedJobId(previewJobId);
  };

  return (
    <div className="space-y-6">
      {/* 提取任务进度横幅 */}
      <CharacterExtractionBanner
        projectId={project.id}
        onOpenPreview={handleOpenPreview}
        recentlyImportedJobId={recentlyImportedJobId}
      />

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight">角色管理</h2>
            <StyleBadge project={project} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            创建角色并设定外貌，生成多种造型，确保分镜画面中角色形象的一致性。
          </p>
        </div>
        <div className="flex gap-2">{project.episodes.length > 0 && (
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
                  <Users className="w-4 h-4 mr-1" />
                  从剧本提取
                </>
              )}
            </Button>
          )}
          <CharacterDialog projectId={project.id} />
        </div>
      </div>

      {project.characters.length === 0 ? (
        <EmptyState 
          projectId={project.id} 
          hasEpisodes={project.episodes.length > 0}
          onStartExtraction={handleStartExtraction}
          isStartingExtraction={isStartingExtraction}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {project.characters.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              projectId={project.id}
              isHighlighted={highlightedCharacters.has(character.id)}
            />
          ))}
        </div>
      )}

      {/* 预览和导入对话框 */}
      {previewJobId && (
        <CharacterExtractionDialog
          open={previewDialogOpen}
          onOpenChange={setPreviewDialogOpen}
          projectId={project.id}
          jobId={previewJobId}
          existingCharacters={project.characters.map(c => ({ id: c.id, name: c.name }))}
          onImportSuccess={handleImportSuccess}
        />
      )}
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
        <Users className="w-10 h-10 text-primary" />
      </div>
      <h3 className="text-2xl font-semibold mb-3">开始创建角色</h3>
      <p className="text-muted-foreground mb-8 max-w-md leading-relaxed">
        为你的作品添加角色，设定他们的外貌特征和性格，然后生成多种造型。
        这将帮助 AI 在生成分镜时保持角色形象的一致性。
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
                从剧本提取角色
              </>
            )}
          </Button>
        )}
        <CharacterDialog 
          projectId={projectId}
          trigger={
            <Button variant={hasEpisodes ? "outline" : "default"} size="lg">
              <Plus className="w-5 h-5 mr-2" />
              手动创建角色
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
          <h4 className="font-medium mb-1 text-sm">创建角色</h4>
          <p className="text-xs text-muted-foreground">
            输入角色名称和基本设定
          </p>
        </div>
        <div className="p-4 rounded-lg bg-muted/30 border">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mb-2 text-sm font-bold text-primary">
            2
          </div>
          <h4 className="font-medium mb-1 text-sm">描述外貌</h4>
          <p className="text-xs text-muted-foreground">
            详细描述发色、瞳色等固定特征
          </p>
        </div>
        <div className="p-4 rounded-lg bg-muted/30 border">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mb-2 text-sm font-bold text-primary">
            3
          </div>
          <h4 className="font-medium mb-1 text-sm">生成造型</h4>
          <p className="text-xs text-muted-foreground">
            AI 自动生成多种造型图片
          </p>
        </div>
      </div>
    </Card>
  );
}