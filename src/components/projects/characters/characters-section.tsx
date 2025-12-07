"use client";

import { useState, useEffect } from "react";
import { Character, CharacterImage, ProjectDetail } from "@/types/project";
import { Card } from "@/components/ui/card";
import { Users, MoreHorizontal, Pencil, Trash2, User, Sparkles, Plus } from "lucide-react";
import { CharacterDialog } from "./character-dialog";
import { CharacterDetailSheet } from "./character-detail-sheet";
import { CharacterExtractionDialog } from "./character-extraction-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteCharacter } from "@/lib/actions/character";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useSearchParams } from "next/navigation";

interface CharactersSectionProps {
  project: ProjectDetail;
}

export function CharactersSection({ project }: CharactersSectionProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<(Character & { images: CharacterImage[] }) | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false);
  const [highlightedCharacters, setHighlightedCharacters] = useState<Set<string>>(new Set());
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

  const handleCardClick = (char: Character & { images: CharacterImage[] }) => {
    setSelectedCharacter(char);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">角色管理</h2>
          <p className="text-sm text-muted-foreground">
            创建角色并设定外貌，生成多种造型，确保分镜画面中角色形象的一致性。
          </p>
        </div>
        <div className="flex gap-2">
          {project.episodes.length > 0 && (
            <Button 
              onClick={() => setExtractionDialogOpen(true)}
              variant="outline"
              className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20 hover:border-primary/40"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              <Users className="w-4 h-4 mr-1" />
              从剧本提取
            </Button>
          )}
          <CharacterDialog projectId={project.id} />
        </div>
      </div>

      {project.characters.length === 0 ? (
        <EmptyState projectId={project.id} hasEpisodes={project.episodes.length > 0} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {project.characters.map((character) => (
            <CharacterCard 
              key={character.id} 
              character={character} 
              projectId={project.id}
              onClick={() => handleCardClick(character)}
              isHighlighted={highlightedCharacters.has(character.id)}
            />
          ))}
        </div>
      )}

      {selectedCharacter && (
        <CharacterDetailSheet
          projectId={project.id}
          character={selectedCharacter}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      )}

      <CharacterExtractionDialog
        open={extractionDialogOpen}
        onOpenChange={setExtractionDialogOpen}
        projectId={project.id}
        existingCharacters={project.characters.map(c => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}

function EmptyState({ projectId, hasEpisodes }: { projectId: string; hasEpisodes: boolean }) {
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false);

  return (
    <>
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
              onClick={() => setExtractionDialogOpen(true)}
              size="lg"
              className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              从剧本提取角色
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

    <CharacterExtractionDialog
      open={extractionDialogOpen}
      onOpenChange={setExtractionDialogOpen}
      projectId={projectId}
      existingCharacters={[]}
    />
  </>
  );
}

function CharacterCard({ 
  character, 
  projectId,
  onClick,
  isHighlighted = false
}: { 
  character: Character & { images: CharacterImage[] }; 
  projectId: string;
  onClick: () => void;
  isHighlighted?: boolean;
}) {
  // Find primary image or use the first one with imageUrl
  const primaryImage = character.images.find(img => img.isPrimary && img.imageUrl) 
    || character.images.find(img => img.imageUrl);
  
  const hasImages = character.images.length > 0;
  const hasGeneratedImages = character.images.some(img => img.imageUrl);
  const pendingImagesCount = character.images.filter(img => !img.imageUrl).length;
  const hasBasicInfo = character.appearance || character.description;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`确定要删除角色「${character.name}」吗？`)) {
      try {
        await deleteCharacter(projectId, character.id);
        toast.success("角色已删除");
      } catch {
        toast.error("删除失败");
      }
    }
  };

  return (
    <Card 
      className={`group relative overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 border-muted hover:border-primary/50 ${
        isHighlighted 
          ? "animate-in fade-in zoom-in duration-500 border-primary shadow-xl shadow-primary/20 ring-2 ring-primary/30" 
          : ""
      }`}
      onClick={onClick}
    >
      <div className="aspect-[3/4] bg-muted relative overflow-hidden">
        {primaryImage?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            src={primaryImage.imageUrl} 
            alt={character.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted/50 to-muted text-muted-foreground">
            <User className="w-16 h-16 opacity-20 mb-3" />
            <p className="text-xs opacity-60">
              {hasImages ? "点击生成造型图片" : "点击生成造型"}
            </p>
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        
        {/* Status Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {isHighlighted && (
            <Badge className="text-[10px] bg-gradient-to-r from-primary to-purple-500 text-white border-0 animate-pulse">
              <Sparkles className="w-3 h-3 mr-1" />
              新导入
            </Badge>
          )}
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
              待创建造型
            </Badge>
          )}
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <h3 className="font-semibold text-lg truncate mb-1">{character.name}</h3>
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/80">
              {hasImages ? (
                hasGeneratedImages 
                  ? `${character.images.filter(img => img.imageUrl).length}/${character.images.length} 个造型`
                  : `${character.images.length} 个造型待生成`
              ) : "暂无造型"}
            </p>
            {hasBasicInfo && (
              <Badge variant="outline" className="text-[10px] text-white border-white/50">
                已设定
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Action Menu - Stop Propagation to prevent card click */}
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
              <Pencil className="mr-2 h-4 w-4" /> 管理角色
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> 删除角色
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
