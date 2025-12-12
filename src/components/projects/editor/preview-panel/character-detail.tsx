"use client";

import { useState } from "react";
import { Character, CharacterImage } from "@/types/project";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { User, Palette, Image as ImageIcon, FileText, Eye, Sparkles, RotateCw } from "lucide-react";
import { 
  EditableField, 
  EditableInput, 
  EditableTextarea,
} from "@/components/ui/inline-editable-field";
import { useAutoSave } from "@/hooks/use-auto-save";
import { updateCharacterInfo, updateCharacterStyleInfo } from "@/lib/actions/character";
import { generateImageForCharacterStyle, regenerateCharacterStyleImage } from "@/lib/actions/character/image";
import { useEditor } from "../editor-context";
import { getProjectDetail } from "@/lib/actions/project";
import { toast } from "sonner";

interface CharacterDetailProps {
  character: Character & { images: CharacterImage[] };
}

interface FormData {
  name: string;
  description: string;
  appearance: string;
}

export function CharacterDetail({ character }: CharacterDetailProps) {
  const { updateProject } = useEditor();
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

  const [styleSaveStatus, setStyleSaveStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [styleTimers, setStyleTimers] = useState<Record<string, NodeJS.Timeout>>({});
  const [generatingImages, setGeneratingImages] = useState<Record<string, boolean>>({});

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
      
      // 刷新项目数据
      if (result.success) {
        const updatedProject = await getProjectDetail(character.projectId);
        if (updatedProject) {
          updateProject(updatedProject);
        }
      }
      
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
          
          // 刷新项目数据
          const updatedProject = await getProjectDetail(character.projectId);
          if (updatedProject) {
            updateProject(updatedProject);
          }
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
          
          // 刷新项目数据
          const updatedProject = await getProjectDetail(character.projectId);
          if (updatedProject) {
            updateProject(updatedProject);
          }
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
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{character.images.length} 造型</Badge>
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

            <div className="grid gap-4 sm:grid-cols-2">
              {character.images.map((image) => {
                const styleLabel = styleLabelMap[image.id] || image.label;
                const stylePrompt = stylePromptMap[image.id] || image.imagePrompt || "";
                const styleSaveState = styleSaveStatus[image.id] || "idle";
                const isGenerating = generatingImages[image.id] || false;
                const hasImage = !!image.imageUrl;

                return (
                  <div
                    key={image.id}
                    className="border rounded-lg overflow-hidden bg-card"
                  >
                    <div className="relative aspect-square bg-muted flex items-center justify-center group">
                      {hasImage ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.imageUrl}
                            alt={styleLabel}
                            className="w-full h-full object-cover"
                          />
                          {/* 悬停时显示重新生成按钮 */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleRegenerateImage(image.id)}
                              disabled={isGenerating}
                            >
                              <RotateCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                              {isGenerating ? "生成中..." : "重新生成"}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-3 p-4">
                          <ImageIcon className="w-12 h-12 text-muted-foreground/50" />
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
                        </div>
                      )}
                    </div>
                    <div className="p-3 space-y-2">
                      {/* 造型标签 - 内联编辑 */}
                      <div className="flex items-center gap-2">
                        <EditableInput
                          value={styleLabel}
                          onChange={(label) => updateStyleLabel(image.id, label)}
                          placeholder="造型标签"
                          emptyText="点击输入标签"
                          className="flex-1 text-sm font-medium"
                          inputClassName="h-auto py-1 text-sm font-medium"
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
                          minHeight="min-h-[60px]"
                          rows={2}
                        />
                      </EditableField>
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
    </ScrollArea>
  );
}

