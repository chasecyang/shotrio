"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Character, CharacterImage } from "@/types/project";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Plus, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { 
  deleteCharacter, 
  updateCharacterInfo, 
  updateCharacterStyleInfo,
  createCharacterStyle 
} from "@/lib/actions/character";
import { CharacterCardHeader } from "./character-card-header";
import { CharacterBasicInfoTab } from "./character-basic-info-tab";
import { CharacterStyleTab } from "./character-style-tab";
import { ImagePreviewDialog } from "./image-preview-dialog";
import { useAutoSave, SaveStatus } from "./hooks/use-auto-save";
import { ChipNav, ChipNavItem } from "./chip-nav";

interface CharacterCardProps {
  character: Character & { images: CharacterImage[] };
  projectId: string;
  isHighlighted?: boolean;
}

interface FormData {
  name: string;
  description: string;
  appearance: string;
}

interface StyleData {
  label: string;
  imagePrompt: string;
}

export function CharacterCard({ 
  character, 
  projectId,
  isHighlighted = false,
}: CharacterCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreatingStyle, setIsCreatingStyle] = useState(false);
  const [previewImage, setPreviewImage] = useState<CharacterImage | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("basic-info");
  
  const [formData, setFormData] = useState<FormData>({
    name: character.name,
    description: character.description || "",
    appearance: character.appearance || "",
  });

  const [styleDataMap, setStyleDataMap] = useState<Record<string, StyleData>>(() => {
    const initialMap: Record<string, StyleData> = {};
    character.images.forEach(image => {
      initialMap[image.id] = {
        label: image.label,
        imagePrompt: image.imagePrompt || "",
      };
    });
    return initialMap;
  });
  
  const [styleSaveStatus, setStyleSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [styleTimers, setStyleTimers] = useState<Record<string, NodeJS.Timeout>>({});

  const hasBasicInfo = !!(formData.appearance || formData.description);

  const { saveStatus } = useAutoSave({
    data: formData,
    originalData: {
      name: character.name,
      description: character.description || "",
      appearance: character.appearance || "",
    },
    onSave: async (data) => {
      return await updateCharacterInfo(projectId, character.id, {
        name: data.name,
        description: data.description || undefined,
        appearance: data.appearance || undefined,
      });
    },
  });

  const updateStyleData = (imageId: string, field: keyof StyleData, value: string) => {
    setStyleDataMap(prev => ({
      ...prev,
      [imageId]: {
        ...prev[imageId],
        [field]: value,
      },
    }));

    if (styleTimers[imageId]) {
      clearTimeout(styleTimers[imageId]);
    }

    const timer = setTimeout(async () => {
      const currentData = { ...styleDataMap[imageId], [field]: value };
      setStyleSaveStatus(prev => ({ ...prev, [imageId]: "saving" }));
      
      try {
        const result = await updateCharacterStyleInfo(projectId, imageId, {
          label: currentData.label,
          imagePrompt: currentData.imagePrompt,
        });

        if (result.success) {
          setStyleSaveStatus(prev => ({ ...prev, [imageId]: "saved" }));
          setTimeout(() => {
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

    setStyleTimers(prev => ({ ...prev, [imageId]: timer }));
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
        setActiveTab(`style-${result.imageId}`);
        startTransition(() => {
          router.refresh();
        });
      } else {
        toast.error(result.error || "创建失败");
      }
    } catch (error) {
      toast.error("创建失败");
      console.error(error);
    } finally {
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
        <CharacterCardHeader
          name={formData.name}
          onNameChange={(name) => setFormData({ ...formData, name })}
          images={character.images}
          hasBasicInfo={hasBasicInfo}
          isHighlighted={isHighlighted}
          saveStatus={saveStatus}
          onDelete={handleDelete}
        />

        <div className="px-3 py-1.5 sm:px-4 sm:py-2">
          <ChipNav>
            <ChipNavItem 
              active={activeTab === "basic-info"}
              onClick={() => setActiveTab("basic-info")}
            >
              基础信息
            </ChipNavItem>
            {character.images.map((image, index) => (
              <ChipNavItem 
                key={image.id}
                active={activeTab === `style-${image.id}`}
                onClick={() => setActiveTab(`style-${image.id}`)}
              >
                {image.isPrimary && (
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500 drop-shadow-sm" />
                )}
                {image.label || `造型 ${index + 1}`}
              </ChipNavItem>
            ))}
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleCreateStyle}
                  disabled={!hasBasicInfo || isCreatingStyle || isPending}
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 shrink-0 rounded-lg"
                >
                  {isCreatingStyle || isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                创建新造型
              </TooltipContent>
            </Tooltip>
          </ChipNav>
        </div>

        <div className="min-h-[300px]">
          {activeTab === "basic-info" && (
            <CharacterBasicInfoTab
              description={formData.description}
              appearance={formData.appearance}
              onDescriptionChange={(value) => setFormData({ ...formData, description: value })}
              onAppearanceChange={(value) => setFormData({ ...formData, appearance: value })}
              hasBasicInfo={hasBasicInfo}
            />
          )}

          {character.images.map((image) => {
            const styleData = styleDataMap[image.id] || { 
              label: image.label, 
              imagePrompt: image.imagePrompt || "" 
            };
            const styleSaveState = styleSaveStatus[image.id] || "idle";

            return activeTab === `style-${image.id}` ? (
              <CharacterStyleTab
                key={image.id}
                image={image}
                projectId={projectId}
                characterId={character.id}
                styleLabel={styleData.label}
                imagePrompt={styleData.imagePrompt}
                saveStatus={styleSaveState}
                onLabelChange={(value) => updateStyleData(image.id, "label", value)}
                onImagePromptChange={(value) => updateStyleData(image.id, "imagePrompt", value)}
                onPreview={() => {
                  setPreviewImage(image);
                  setPreviewOpen(true);
                }}
                onDeleted={() => setActiveTab("basic-info")}
              />
            ) : null;
          })}
        </div>
      </Card>

      <ImagePreviewDialog
        image={previewImage}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </>
  );
}
