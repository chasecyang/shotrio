"use client";

import { useState, useEffect } from "react";
import { Character, CharacterImage } from "@/types/project";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { User, Palette, Image as ImageIcon, FileText, Eye, Sparkles, RotateCw, Trash2, Loader2 } from "lucide-react";
import { 
  EditableField, 
  EditableInput, 
  EditableTextarea,
} from "@/components/ui/inline-editable-field";
import { useAutoSave } from "@/hooks/use-auto-save";
import { updateCharacterInfo, updateCharacterStyleInfo, deleteCharacter } from "@/lib/actions/character";
import { generateImageForCharacterStyle, regenerateCharacterStyleImage } from "@/lib/actions/character/image";
import { useEditor } from "../editor-context";
import { getProjectDetail } from "@/lib/actions/project";
import { toast } from "sonner";
import type { Job, CharacterImageGenerationInput } from "@/types/job";
import { CharacterImageViewer } from "@/components/projects/characters/character-image-viewer";

interface CharacterDetailProps {
  character: Character & { images: CharacterImage[] };
}

interface FormData {
  name: string;
  description: string;
  appearance: string;
}

export function CharacterDetail({ character }: CharacterDetailProps) {
  const { updateProject, selectResource } = useEditor();
  const primaryImage = character.images.find((img) => img.isPrimary) || character.images[0];
  
  const [formData, setFormData] = useState<FormData>({
    name: character.name,
    description: character.description || "",
    appearance: character.appearance || "",
  });

  const [styleLabelMap, setStyleLabelMap] = useState<Record<string, string>>(() => {
    const initialMap: Record<string, string> = {};
    character.images.forEach(image => {
      initialMap[image.id] = image.label;
    });
    return initialMap;
  });

  const [stylePromptMap, setStylePromptMap] = useState<Record<string, string>>(() => {
    const initialMap: Record<string, string> = {};
    character.images.forEach(image => {
      initialMap[image.id] = image.imagePrompt || "";
    });
    return initialMap;
  });

  // 当角色切换时，重置所有表单数据
  useEffect(() => {
    setFormData({
      name: character.name,
      description: character.description || "",
      appearance: character.appearance || "",
    });

    // 重置造型标签映射
    const newStyleLabelMap: Record<string, string> = {};
    character.images.forEach(image => {
      newStyleLabelMap[image.id] = image.label;
    });
    setStyleLabelMap(newStyleLabelMap);

    // 重置造型提示词映射
    const newStylePromptMap: Record<string, string> = {};
    character.images.forEach(image => {
      newStylePromptMap[image.id] = image.imagePrompt || "";
    });
    setStylePromptMap(newStylePromptMap);
  }, [character.id, character.name, character.description, character.appearance, character.images]);

  const [styleSaveStatus, setStyleSaveStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [styleTimers, setStyleTimers] = useState<Record<string, NodeJS.Timeout>>({});
  const [generatingImages, setGeneratingImages] = useState<Record<string, boolean>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewingImage, setViewingImage] = useState<CharacterImage | null>(null);

  // 从 EditorContext 获取任务状态（单例轮询）
  const { jobs } = useEditor();

  // 查找角色图片生成任务
  const getImageGenerationJob = (imageId: string) => {
    return jobs.find((job) => {
      if (job.type !== "character_image_generation") return false;
      if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") return false;
      
      try {
        const input: CharacterImageGenerationInput = JSON.parse(job.inputData || "{}");
        return input.imageId === imageId;
      } catch {
        return false;
      }
    }) as Partial<Job> | undefined;
  };

  // 基础信息自动保存
  const { saveStatus } = useAutoSave({
    data: formData,
    originalData: {
      name: character.name,
      description: character.description || "",
      appearance: character.appearance || "",
    },
    onSave: async (data) => {
      const result = await updateCharacterInfo(
        character.projectId,
        character.id,
        {
          name: data.name,
          description: data.description || undefined,
          appearance: data.appearance || undefined,
        }
      );
      
      // 基础信息更新不需要手动刷新，EditorContext 会在角色图片生成完成时自动刷新
      return result;
    },
  });

  // 造型标签自动保存
  const updateStyleLabel = async (imageId: string, label: string) => {
    setStyleLabelMap(prev => ({ ...prev, [imageId]: label }));
    
    if (styleTimers[imageId]) {
      clearTimeout(styleTimers[imageId]);
    }

    const timer = setTimeout(async () => {
      setStyleSaveStatus(prev => ({ ...prev, [imageId]: "saving" }));
      
      try {
        const result = await updateCharacterStyleInfo(character.projectId, imageId, {
          label,
          imagePrompt: stylePromptMap[imageId],
        });

        if (result.success) {
          setStyleSaveStatus(prev => ({ ...prev, [imageId]: "saved" }));
          setTimeout(() => {
            setStyleSaveStatus(prev => ({ ...prev, [imageId]: "idle" }));
          }, 3000);
        } else {
          setStyleSaveStatus(prev => ({ ...prev, [imageId]: "error" }));
        }
      } catch (error) {
        setStyleSaveStatus(prev => ({ ...prev, [imageId]: "error" }));
        console.error(error);
      }
    }, 1500);

    setStyleTimers(prev => ({ ...prev, [imageId]: timer }));
  };

  // 造型提示词自动保存
  const updateStylePrompt = async (imageId: string, imagePrompt: string) => {
    setStylePromptMap(prev => ({ ...prev, [imageId]: imagePrompt }));
    
    if (styleTimers[`${imageId}-prompt`]) {
      clearTimeout(styleTimers[`${imageId}-prompt`]);
    }

    const timer = setTimeout(async () => {
      setStyleSaveStatus(prev => ({ ...prev, [imageId]: "saving" }));
      
      try {
        const result = await updateCharacterStyleInfo(character.projectId, imageId, {
          label: styleLabelMap[imageId],
          imagePrompt,
        });

        if (result.success) {
          setStyleSaveStatus(prev => ({ ...prev, [imageId]: "saved" }));
          setTimeout(() => {
            setStyleSaveStatus(prev => ({ ...prev, [imageId]: "idle" }));
          }, 3000);
        } else {
          setStyleSaveStatus(prev => ({ ...prev, [imageId]: "error" }));
        }
      } catch (error) {
        setStyleSaveStatus(prev => ({ ...prev, [imageId]: "error" }));
        console.error(error);
      }
    }, 1500);

    setStyleTimers(prev => ({ ...prev, [`${imageId}-prompt`]: timer }));
  };

  // 生成造型图片
  const handleGenerateImage = async (imageId: string) => {
    setGeneratingImages(prev => ({ ...prev, [imageId]: true }));
    
    try {
      const result = await generateImageForCharacterStyle(
        character.projectId,
        character.id,
        imageId
      );

      if (result.success) {
        toast.success("已开始生成图片，请稍后在任务中心查看进度");
      } else {
        toast.error(result.error || "创建任务失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("生成图片失败");
    } finally {
      setGeneratingImages(prev => ({ ...prev, [imageId]: false }));
    }
  };

  // 重新生成造型图片
  const handleRegenerateImage = async (imageId: string) => {
    setGeneratingImages(prev => ({ ...prev, [imageId]: true }));
    
    try {
      const result = await regenerateCharacterStyleImage(
        character.projectId,
        character.id,
        imageId
      );

      if (result.success) {
        toast.success("已开始重新生成图片，请稍后在任务中心查看进度");
      } else {
        toast.error(result.error || "创建任务失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("重新生成图片失败");
    } finally {
      setGeneratingImages(prev => ({ ...prev, [imageId]: false }));
    }
  };

  // 删除角色
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteCharacter(character.projectId, character.id);
      
      if (result.success) {
        toast.success("角色已删除");
        
        // 清除选中状态
        selectResource(null);
        
        // 刷新项目数据
        const updatedProject = await getProjectDetail(character.projectId);
        if (updatedProject) {
          updateProject(updatedProject);
        }
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("删除角色失败");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* 头部：头像 + 基本信息 */}
        <div className="flex items-start gap-6">
          <Avatar className="w-24 h-24 border-2 border-primary/20">
            <AvatarImage src={primaryImage?.imageUrl || undefined} />
            <AvatarFallback className="text-3xl bg-primary/10 text-primary">
              {formData.name[0] || "角"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{character.images.length} 造型</Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            
            {/* 角色名称 - 内联编辑 */}
            <EditableField
              label="角色名称"
              icon={User}
              saveStatus={saveStatus}
            >
              <EditableInput
                value={formData.name}
                onChange={(name) => setFormData({ ...formData, name })}
                placeholder="输入角色名称"
                emptyText="点击输入角色名称"
                className="text-2xl font-semibold"
                inputClassName="text-2xl font-semibold h-auto py-1"
              />
            </EditableField>

            {/* 角色设定 - 内联编辑 */}
            <EditableField
              label="角色设定"
              icon={FileText}
              tooltip="描述角色的性格、背景、职业等基本设定信息"
              saveStatus={saveStatus}
            >
              <EditableTextarea
                value={formData.description}
                onChange={(description) => setFormData({ ...formData, description })}
                placeholder="例如：性格开朗活泼，是学校的人气偶像。出身音乐世家，擅长钢琴和声乐..."
                emptyText="点击输入角色设定"
                minHeight="min-h-[60px]"
              />
            </EditableField>
          </div>
        </div>

        <Separator />

        {/* 外貌描述 - 内联编辑 */}
        <EditableField
          label="外貌特征"
          icon={Eye}
          tooltip="描述角色固定的外貌特征，如发色、瞳色、身高、体型等不会变化的特点"
          saveStatus={saveStatus}
        >
          <EditableTextarea
            value={formData.appearance}
            onChange={(appearance) => setFormData({ ...formData, appearance })}
            placeholder="例如：银色长发及腰，红色眼瞳，左眼下方有泪痣。身材高挑，约170cm..."
            emptyText="点击输入外貌描述"
            minHeight="min-h-[80px]"
          />
        </EditableField>

        {/* 造型列表 */}
        {character.images.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Palette className="w-4 h-4 text-muted-foreground" />
              角色造型
            </div>

            <div className="space-y-3">
              {character.images.map((image) => {
                const styleLabel = styleLabelMap[image.id] || image.label;
                const stylePrompt = stylePromptMap[image.id] || image.imagePrompt || "";
                const styleSaveState = styleSaveStatus[image.id] || "idle";
                const isGenerating = generatingImages[image.id] || false;
                const hasImage = !!image.imageUrl;
                const imageJob = getImageGenerationJob(image.id);

                return (
                  <div
                    key={image.id}
                    className="border rounded-lg overflow-hidden bg-card"
                  >
                    {/* 任务进度显示 */}
                    {imageJob && imageJob.status === "processing" && (
                      <div className="p-3 border-b bg-muted/50 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          <span className="font-medium">生成中...</span>
                        </div>
                        <Progress value={imageJob.progress || 0} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          {imageJob.progressMessage || `进度: ${imageJob.progress || 0}%`}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row">
                      {/* 左侧图片区域 */}
                      <div className="relative w-full sm:w-48 h-48 sm:h-auto bg-muted flex items-center justify-center group shrink-0">
                        {hasImage ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={image.imageUrl ?? ''}
                              alt={styleLabel}
                              className="w-full h-full object-cover cursor-pointer"
                              onClick={() => setViewingImage(image)}
                            />
                            {/* 悬停时显示操作按钮 */}
                            {!imageJob && (
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 p-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingImage(image);
                                  }}
                                  className="w-full"
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  查看大图
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRegenerateImage(image.id);
                                  }}
                                  disabled={isGenerating}
                                  className="w-full"
                                >
                                  <RotateCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                                  重新生成
                                </Button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-3 p-4">
                            <ImageIcon className="w-12 h-12 text-muted-foreground/50" />
                            {!imageJob ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleGenerateImage(image.id)}
                                  disabled={isGenerating || !stylePrompt}
                                >
                                  <Sparkles className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                                  {isGenerating ? "生成中..." : "生成图片"}
                                </Button>
                                {!stylePrompt && (
                                  <p className="text-xs text-muted-foreground text-center">
                                    请先输入提示词
                                  </p>
                                )}
                              </>
                            ) : (
                              <div className="flex flex-col items-center gap-2 text-sm text-primary">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>生成中...</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 右侧信息区域 */}
                      <div className="flex-1 p-4 space-y-3">
                        {/* 造型标签 - 内联编辑 */}
                        <div className="flex items-center gap-2">
                          <EditableInput
                            value={styleLabel}
                            onChange={(label) => updateStyleLabel(image.id, label)}
                            placeholder="造型标签"
                            emptyText="点击输入标签"
                            className="flex-1 text-base font-medium"
                            inputClassName="h-auto py-1 text-base font-medium"
                          />
                          {image.isPrimary && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              主造型
                            </Badge>
                          )}
                        </div>
                        
                        {/* 提示词 - 内联编辑 */}
                        <EditableField
                          label="图片提示词"
                          saveStatus={styleSaveState}
                        >
                          <EditableTextarea
                            value={stylePrompt}
                            onChange={(prompt) => updateStylePrompt(image.id, prompt)}
                            placeholder="描述这个造型的特征..."
                            emptyText="点击输入提示词"
                            minHeight="min-h-[80px]"
                            rows={3}
                          />
                        </EditableField>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {character.images.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">暂无造型图片</p>
            <p className="text-xs mt-1">可以在角色页面生成造型</p>
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除角色</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除角色 &ldquo;{character.name}&rdquo; 吗？此操作无法撤销，所有关联的造型和图片都将被删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 图片查看器 */}
      {viewingImage && (
        <CharacterImageViewer
          imageUrl={viewingImage.imageUrl || ""}
          imageLabel={viewingImage.label}
          characterName={character.name}
          open={!!viewingImage}
          onOpenChange={(open) => {
            if (!open) setViewingImage(null);
          }}
        />
      )}
    </ScrollArea>
  );
}

