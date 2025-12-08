"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Character, CharacterImage, ProjectDetail } from "@/types/project";
import { Card } from "@/components/ui/card";
import { Users, MoreHorizontal, Trash2, Sparkles, Plus, Loader2, Check, X, Image as ImageIcon, Eye, Star, HelpCircle } from "lucide-react";
import { CharacterDialog } from "./character-dialog";
import { CharacterExtractionDialog } from "./character-extraction-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteCharacter, updateCharacterInfo, updateCharacterStyleInfo, createCharacterStyle, generateImageForCharacterStyle, deleteCharacterImage, setCharacterPrimaryImage } from "@/lib/actions/character";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useSearchParams, useRouter } from "next/navigation";
import { EditableInput, EditableTextarea } from "./editable-field";
import { cn } from "@/lib/utils";
import { ImagePreviewDialog } from "./image-preview-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CharactersSectionProps {
  project: ProjectDetail;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function CharactersSection({ project }: CharactersSectionProps) {
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
  isHighlighted = false,
}: { 
  character: Character & { images: CharacterImage[] }; 
  projectId: string;
  isHighlighted?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreatingStyle, setIsCreatingStyle] = useState(false);
  const [previewImage, setPreviewImage] = useState<CharacterImage | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("basic-info");
  
  // 表单数据和自动保存
  const [formData, setFormData] = useState({
    name: character.name,
    description: character.description || "",
    appearance: character.appearance || "",
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const savedTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // 造型信息状态管理
  const [styleDataMap, setStyleDataMap] = useState<Record<string, { label: string; imagePrompt: string }>>(() => {
    const initialMap: Record<string, { label: string; imagePrompt: string }> = {};
    character.images.forEach(image => {
      initialMap[image.id] = {
        label: image.label,
        imagePrompt: image.imagePrompt || "",
      };
    });
    return initialMap;
  });
  const [styleSaveStatus, setStyleSaveStatus] = useState<Record<string, SaveStatus>>({});
  const styleSaveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const styleSavedTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  const hasBasicInfo = !!(formData.appearance || formData.description);
  const hasImages = character.images.length > 0;
  const hasGeneratedImages = character.images.some(img => img.imageUrl);
  const pendingImagesCount = character.images.filter(img => !img.imageUrl).length;

  // 自动保存逻辑
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const hasChanges =
      formData.name !== character.name ||
      formData.description !== (character.description || "") ||
      formData.appearance !== (character.appearance || "");

    if (hasChanges) {
      setSaveStatus("idle");

      saveTimeoutRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          const result = await updateCharacterInfo(projectId, character.id, {
            name: formData.name,
            description: formData.description || undefined,
            appearance: formData.appearance || undefined,
          });

          if (result.success) {
            setSaveStatus("saved");

            if (savedTimeoutRef.current) {
              clearTimeout(savedTimeoutRef.current);
            }
            savedTimeoutRef.current = setTimeout(() => {
              setSaveStatus("idle");
            }, 3000);
          } else {
            setSaveStatus("error");
            toast.error(result.error || "保存失败");
          }
        } catch (error) {
          setSaveStatus("error");
          console.error(error);
          toast.error("保存失败");
        }
      }, 1500);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, character, projectId]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
      // 清理造型保存定时器
      Object.values(styleSaveTimeouts.current).forEach(timeout => clearTimeout(timeout));
      Object.values(styleSavedTimeouts.current).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // 更新造型信息
  const updateStyleData = async (imageId: string, field: "label" | "imagePrompt", value: string) => {
    // 更新本地状态
    setStyleDataMap(prev => ({
      ...prev,
      [imageId]: {
        ...prev[imageId],
        [field]: value,
      },
    }));

    // 清除之前的定时器
    if (styleSaveTimeouts.current[imageId]) {
      clearTimeout(styleSaveTimeouts.current[imageId]);
    }

    // 设置新的保存定时器
    setStyleSaveStatus(prev => ({ ...prev, [imageId]: "idle" }));
    
    styleSaveTimeouts.current[imageId] = setTimeout(async () => {
      setStyleSaveStatus(prev => ({ ...prev, [imageId]: "saving" }));
      try {
        const result = await updateCharacterStyleInfo(projectId, imageId, {
          label: field === "label" ? value : styleDataMap[imageId]?.label,
          imagePrompt: field === "imagePrompt" ? value : styleDataMap[imageId]?.imagePrompt,
        });

        if (result.success) {
          setStyleSaveStatus(prev => ({ ...prev, [imageId]: "saved" }));
          
          if (styleSavedTimeouts.current[imageId]) {
            clearTimeout(styleSavedTimeouts.current[imageId]);
          }
          styleSavedTimeouts.current[imageId] = setTimeout(() => {
            setStyleSaveStatus(prev => ({ ...prev, [imageId]: "idle" }));
          }, 3000);
        } else {
          setStyleSaveStatus(prev => ({ ...prev, [imageId]: "error" }));
          toast.error(result.error || "保存失败");
        }
      } catch (error) {
        setStyleSaveStatus(prev => ({ ...prev, [imageId]: "error" }));
        console.error(error);
        toast.error("保存失败");
      }
    }, 1500);
  };

  const handleDelete = async () => {
    if (confirm(`确定要删除角色「${character.name}」吗？`)) {
      try {
        await deleteCharacter(projectId, character.id);
        toast.success("角色已删除");
      } catch {
        toast.error("删除失败");
      }
    }
  };

  const handleCreateStyle = async () => {
    if (!hasBasicInfo) {
      toast.error("请先完善角色的外貌描述");
      return;
    }

    setIsCreatingStyle(true);
    try {
      const styleCount = character.images.length + 1;
      const defaultLabel = `造型 ${styleCount}`;
      const defaultPrompt = `角色的第 ${styleCount} 个造型`;

      const result = await createCharacterStyle(projectId, character.id, {
        label: defaultLabel,
        stylePrompt: defaultPrompt,
      });

      if (result.success && result.imageId) {
        toast.success("造型已创建");
        // 切换到新创建的造型tab
        setActiveTab(`style-${result.imageId}`);
        startTransition(() => {
          router.refresh();
        });
        setIsCreatingStyle(false);
      } else {
        toast.error(result.error || "创建失败");
        setIsCreatingStyle(false);
      }
    } catch (error) {
      toast.error("创建失败");
      console.error(error);
      setIsCreatingStyle(false);
    }
  };

  return (
    <>
      <Card 
        className={cn(
          "group relative overflow-hidden transition-all duration-300 bg-card hover:shadow-sm",
          isHighlighted && "animate-in fade-in zoom-in duration-500 border-primary shadow-lg shadow-primary/20"
        )}
      >
        {/* 顶部区域：角色名称 + 状态标签 */}
        <div className="relative border-b px-3 py-3 bg-muted/50">
          <div className="flex items-center justify-between gap-2">
            {/* 左侧：角色名称和标签 */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <EditableInput
                value={formData.name}
                onChange={(value) => setFormData({ ...formData, name: value })}
                placeholder="角色名称"
                emptyText="点击输入角色名称"
                className="text-sm font-semibold"
                inputClassName="text-sm font-semibold h-7"
              />
              
              {/* 状态标签 - 在名称右侧紧凑显示 */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {isHighlighted && (
                  <Badge className="text-[10px] h-5 bg-gradient-to-r from-primary to-purple-500 text-white border-0 animate-pulse">
                    <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                    新
                  </Badge>
                )}
                {!hasBasicInfo && (
                  <Badge variant="secondary" className="text-[10px] h-5 bg-orange-500/90 text-white border-0">
                    待设定
                  </Badge>
                )}
                {hasImages && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "text-[10px] h-5 font-mono border-0 cursor-help",
                          hasGeneratedImages && pendingImagesCount === 0
                            ? "bg-primary/90 text-white"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <ImageIcon className="w-2.5 h-2.5 mr-0.5" />
                        {character.images.filter(img => img.imageUrl).length}/{character.images.length}
                  </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      <div className="space-y-0.5">
                        <div>已生成：{character.images.filter(img => img.imageUrl).length} 个造型</div>
                        <div>待生成：{pendingImagesCount} 个造型</div>
                        <div className="text-muted-foreground">总计：{character.images.length} 个造型</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            {/* 右侧：操作区 */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* 保存状态指示器 */}
              {saveStatus !== "idle" && (
                <div className="flex items-center">
                  {saveStatus === "saving" && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                  {saveStatus === "saved" && (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  )}
                  {saveStatus === "error" && (
                    <X className="h-3.5 w-3.5 text-destructive" />
                  )}
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={handleDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> 删除角色
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Tab导航栏和内容 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab导航栏 */}
          <div className="border-b">
            <div className="px-3 overflow-x-auto overflow-y-hidden">
              <div className="flex items-center gap-1 min-w-max">
                <TabsList className="bg-transparent p-0 h-auto inline-flex">
                  <TabsTrigger 
                    value="basic-info" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 text-xs transition-colors"
                  >
                    基础信息
                  </TabsTrigger>
                  {character.images.map((image, index) => (
                    <TabsTrigger 
                      key={image.id}
                      value={`style-${image.id}`}
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 text-xs transition-colors relative"
                    >
                      {image.label || `造型 ${index + 1}`}
                      {image.isPrimary && (
                        <Star className="w-2.5 h-2.5 absolute -top-0.5 -right-0.5 text-primary fill-current" />
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                {/* 新建造型按钮 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleCreateStyle}
                      disabled={!hasBasicInfo || isCreatingStyle || isPending}
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 shrink-0 ml-1"
                    >
                      {isCreatingStyle || isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    创建新造型
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Tab内容区域 */}
          <div className="min-h-[300px]">
            {/* 基础信息Tab内容 */}
            <TabsContent value="basic-info" className="p-3 space-y-3 m-0">
              <div className="space-y-3">
                {/* 角色设定 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    角色设定
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground/60 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[280px]">
                        描述角色的性格、背景、职业等基本设定信息
                      </TooltipContent>
                    </Tooltip>
                  </label>
                  <EditableTextarea
                    value={formData.description}
                    onChange={(value) => setFormData({ ...formData, description: value })}
                    placeholder="例如：性格开朗活泼，是学校的人气偶像。出身音乐世家，擅长钢琴和声乐..."
                    emptyText="点击输入角色设定"
                    minHeight="min-h-[80px]"
                  />
                </div>

                {/* 外貌描述 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    外貌描述
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground/60 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[280px]">
                        描述角色固定的外貌特征，如发色、瞳色、身高、体型等不会变化的特点
                      </TooltipContent>
                    </Tooltip>
                  </label>
                  <EditableTextarea
                    value={formData.appearance}
                    onChange={(value) => setFormData({ ...formData, appearance: value })}
                    placeholder="例如：银色长发及腰，红色眼瞳，左眼下方有泪痣。身材高挑，约170cm..."
                    emptyText="点击输入外貌描述"
                    minHeight="min-h-[80px]"
                  />
                </div>

                {/* 提示信息 */}
                {!hasBasicInfo && (
                  <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <div className="flex gap-2">
                      <Sparkles className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-orange-900 dark:text-orange-200">
                          完善角色信息后即可创建造型
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* 造型Tabs内容 */}
            {character.images.map((image) => {
              const styleData = styleDataMap[image.id] || { label: image.label, imagePrompt: image.imagePrompt || "" };
              const styleSaveState = styleSaveStatus[image.id] || "idle";
              const hasImage = !!image.imageUrl;

              return (
                <TabsContent key={image.id} value={`style-${image.id}`} className="p-3 m-0">
                  <div className="grid md:grid-cols-2 gap-3">
                    {/* 左侧：图片展示区 */}
                    <div className="space-y-2">
                      {/* 图片展示 */}
                      <div 
                        className={cn(
                          "relative aspect-square rounded-lg overflow-hidden border",
                          hasImage ? "border-border bg-muted cursor-pointer hover:border-primary/50 transition-colors group" : "border-dashed border-muted-foreground/30 bg-muted/30"
                        )}
                        onClick={hasImage ? () => {
                          setPreviewImage(image);
                          setPreviewOpen(true);
                        } : undefined}
                      >
                        {hasImage ? (
                          <>
                            <img
                              src={image.imageUrl || ""}
                              alt={styleData.label}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            {image.isPrimary && (
                              <div className="absolute top-2 left-2">
                                <Badge className="text-[10px] h-5 bg-primary/90 text-white border-0">
                                  <Star className="w-2.5 h-2.5 mr-0.5 fill-current" />
                                  主图
                                </Badge>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-4">
                            <ImageIcon className="w-12 h-12 text-muted-foreground/40 mb-3" />
                            <p className="text-xs text-muted-foreground mb-3 text-center">
                              暂无图片
                            </p>
                            <Button
                              size="sm"
                              onClick={async () => {
                                try {
                                  const result = await generateImageForCharacterStyle(projectId, character.id, image.id);
                                  if (result.success) {
                                    toast.success("已提交图片生成任务");
                                  } else {
                                    toast.error(result.error || "提交任务失败");
                                  }
                                } catch {
                                  toast.error("提交任务出错");
                                }
                              }}
                            >
                              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                              生成图片
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* 操作按钮组 */}
                      <div className="flex flex-wrap gap-1.5">
                        {hasImage && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPreviewImage(image);
                                setPreviewOpen(true);
                              }}
                              className="flex-1 h-7 text-xs"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              查看
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  await setCharacterPrimaryImage(projectId, character.id, image.id);
                                  toast.success("已设为主图");
                                  startTransition(() => {
                                    router.refresh();
                                  });
                                } catch {
                                  toast.error("设置失败");
                                }
                              }}
                              disabled={image.isPrimary || isPending}
                              className="flex-1 h-7 text-xs"
                            >
                              <Star className="w-3 h-3 mr-1" />
                              {image.isPrimary ? "主图" : "设为主图"}
                            </Button>
                          </>
                        )}
                        {!hasImage && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                const result = await generateImageForCharacterStyle(projectId, character.id, image.id);
                                if (result.success) {
                                  toast.success("已提交图片生成任务");
                                } else {
                                  toast.error(result.error || "提交任务失败");
                                }
                              } catch {
                                toast.error("提交任务出错");
                              }
                            }}
                            className="flex-1 h-7 text-xs"
                          >
                            <Sparkles className="w-3 h-3 mr-1" />
                            生成图片
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            if (!confirm(`确定要删除「${styleData.label}」吗？`)) return;
                            try {
                              await deleteCharacterImage(projectId, image.id);
                              toast.success("已删除");
                              // 切换回基础信息tab
                              setActiveTab("basic-info");
                              startTransition(() => {
                                router.refresh();
                              });
                            } catch {
                              toast.error("删除失败");
                            }
                          }}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          删除
                        </Button>
                      </div>
                    </div>

                    {/* 右侧：造型信息编辑 */}
                    <div className="space-y-3">
                      {/* 保存状态指示器 */}
                      {styleSaveState !== "idle" && (
                        <div className="flex items-center gap-1.5">
                          {styleSaveState === "saving" && (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">保存中</span>
                            </>
                          )}
                          {styleSaveState === "saved" && (
                            <>
                              <Check className="h-3 w-3 text-green-600" />
                              <span className="text-xs text-green-600">已保存</span>
                            </>
                          )}
                          {styleSaveState === "error" && (
                            <>
                              <X className="h-3 w-3 text-destructive" />
                              <span className="text-xs text-destructive">保存失败</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* 造型标签 */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          造型名称
                        </label>
                        <EditableInput
                          value={styleData.label}
                          onChange={(value) => updateStyleData(image.id, "label", value)}
                          placeholder="例如：日常校服"
                          emptyText="点击输入造型名称"
                          className="text-sm font-medium"
                        />
                      </div>

                      {/* 造型提示词 */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          造型描述
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-3 h-3 text-muted-foreground/60 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[280px]">
                              造型描述应包含服装、姿势、表情等可变元素。固定外貌特征已在基础信息中设定。
                            </TooltipContent>
                          </Tooltip>
                        </label>
                        <EditableTextarea
                          value={styleData.imagePrompt}
                          onChange={(value) => updateStyleData(image.id, "imagePrompt", value)}
                          placeholder="例如：穿着校服，白色衬衫配深蓝色百褶裙，系着红色领结..."
                          emptyText="点击输入造型描述"
                          minHeight="min-h-[100px]"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              );
            })}
          </div>
        </Tabs>
      </Card>

      {/* 预览对话框 */}
      <ImagePreviewDialog
        image={previewImage}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </>
  );
}