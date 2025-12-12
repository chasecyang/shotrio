"use client";

import { ShotDetail, ShotSize, CameraMovement, Character, CharacterImage, Scene } from "@/types/project";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Image as ImageIcon, Clock, Users, MessageSquare, Trash2, GripVertical, Plus, X, Maximize2, Video, MapPin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { 
  getShotSizeOptions, 
  getCameraMovementOptions,
  millisecondsToSeconds, 
  secondsToMilliseconds 
} from "@/lib/utils/shot-utils";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { deleteShot, updateShot, removeCharacterFromShot, addDialogueToShot, addCharacterToShot } from "@/lib/actions/project";
import { toast } from "sonner";
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
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EditableField, EditableTextarea, SaveStatus } from "@/components/ui/inline-editable-field";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DialogueEditor } from "./dialogue-editor";

interface ShotCardProps {
  shot: ShotDetail;
  characters: (Character & { images: CharacterImage[] })[];
  scenes: Scene[];
  onUpdate: () => void;
}

export function ShotCard({ shot, characters, scenes, onUpdate }: ShotCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingCharacter, setAddingCharacter] = useState(false);
  const [updatingScene, setUpdatingScene] = useState(false);
  
  // 编辑状态
  const [formData, setFormData] = useState({
    shotSize: shot.shotSize,
    cameraMovement: shot.cameraMovement || "static",
    visualDescription: shot.visualDescription || "",
    duration: millisecondsToSeconds(shot.duration || 3000),
  });
  
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const savedTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // 自动保存逻辑
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const hasChanges =
      formData.shotSize !== shot.shotSize ||
      formData.cameraMovement !== (shot.cameraMovement || "static") ||
      formData.visualDescription !== (shot.visualDescription || "") ||
      formData.duration !== millisecondsToSeconds(shot.duration || 3000);

    if (hasChanges) {
      setSaveStatus("idle");
      
      saveTimeoutRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          const result = await updateShot(shot.id, {
            shotSize: formData.shotSize,
            cameraMovement: formData.cameraMovement,
            visualDescription: formData.visualDescription || null,
            duration: secondsToMilliseconds(formData.duration),
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
        }
      }, 1000);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, shot]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      const result = await deleteShot(shot.id);
      if (result.success) {
        toast.success("删除成功");
        setDeleteDialogOpen(false);
        onUpdate();
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      toast.error("删除失败，请重试");
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDialogOpen(true);
  };

  const handleRemoveCharacter = async (shotCharacterId: string) => {
    try {
      const result = await removeCharacterFromShot(shotCharacterId);
      if (result.success) {
        toast.success("角色已移除");
        onUpdate();
      } else {
        toast.error(result.error || "移除失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("移除失败");
    }
  };

  const handleAddCharacter = async (characterKey: string) => {
    if (!characterKey) return;
    
    setAddingCharacter(true);
    try {
      // characterKey 格式: "characterId" 或 "characterId:imageId"
      const [characterId, imageId] = characterKey.split(":");
      
      const result = await addCharacterToShot({
        shotId: shot.id,
        characterId,
        characterImageId: imageId || undefined,
      });

      if (result.success) {
        toast.success("角色已添加");
        onUpdate();
      } else {
        toast.error(result.error || "添加失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("添加失败");
    } finally {
      setAddingCharacter(false);
    }
  };

  const handleAddDialogue = async () => {
    try {
      const result = await addDialogueToShot({
        shotId: shot.id,
        dialogueText: "",
      });

      if (result.success) {
        toast.success("对话已添加");
        onUpdate();
      } else {
        toast.error(result.error || "添加失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("添加失败");
    }
  };

  const handleSceneChange = async (sceneId: string) => {
    if (sceneId === "none") {
      // 清除场景
      setUpdatingScene(true);
      try {
        const result = await updateShot(shot.id, { sceneId: null });
        if (result.success) {
          toast.success("场景已清除");
          onUpdate();
        } else {
          toast.error(result.error || "更新失败");
        }
      } catch (error) {
        console.error(error);
        toast.error("更新失败");
      } finally {
        setUpdatingScene(false);
      }
      return;
    }

    setUpdatingScene(true);
    try {
      const result = await updateShot(shot.id, { sceneId });
      if (result.success) {
        toast.success("场景已更新");
        onUpdate();
      } else {
        toast.error(result.error || "更新失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("更新失败");
    } finally {
      setUpdatingScene(false);
    }
  };
  
  // 获取可添加的角色列表（排除已添加的）
  const availableCharacters = characters.filter(
    (char) => !shot.shotCharacters.some((sc) => sc.characterId === char.id)
  );
  
  const shotSizeOptions = getShotSizeOptions();
  const cameraMovementOptions = getCameraMovementOptions();

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "border border-border rounded-lg bg-card overflow-hidden transition-colors hover:border-primary/40 flex flex-col max-h-[800px]",
          isDragging && "opacity-50 z-50"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 顶部：镜号 + 删除 */}
        <div className="p-2 border-b bg-muted/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-muted rounded"
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <Badge variant="outline" className="font-mono text-xs flex-shrink-0">
              #{shot.order}
            </Badge>
          </div>

          <div className="flex items-center gap-1 min-w-[24px]">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteClick}
              className={cn(
                "h-6 w-6 p-0 text-muted-foreground hover:text-destructive transition-opacity",
                !isHovered && "opacity-0 pointer-events-none"
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* 中间：缩略图区域 */}
        <div className="aspect-video bg-muted/50 flex items-center justify-center relative group">
          {shot.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shot.imageUrl}
              alt={`分镜 ${shot.order}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
              <ImageIcon className="w-8 h-8" />
              <p className="text-xs">暂无图片</p>
            </div>
          )}
        </div>

        {/* 底部：编辑区域 */}
        <div className="p-3 space-y-3 flex-1 flex flex-col overflow-y-auto">
          {/* 场景选择 */}
          <div className="space-y-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <label className="text-xs font-medium text-muted-foreground">场景</label>
              </div>
              {scenes.length > 0 ? (
                <Select
                  value={shot.sceneId || "none"}
                  onValueChange={handleSceneChange}
                  disabled={updatingScene}
                >
                  <SelectTrigger className="h-7 w-auto text-xs font-medium border-0 bg-transparent hover:bg-muted px-2 max-w-[200px]">
                    <SelectValue placeholder="选择场景" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      无场景
                    </SelectItem>
                    {scenes.map((scene) => (
                      <SelectItem key={scene.id} value={scene.id} className="text-xs">
                        {scene.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs text-muted-foreground">无可用场景</span>
              )}
            </div>
            {shot.scene && shot.scene.description && (
              <p className="text-xs text-muted-foreground pl-5">
                {shot.scene.description}
              </p>
            )}
          </div>

          {/* 视觉描述 */}
          <div className="flex-shrink-0">
            <EditableField
              label="画面"
              icon={ImageIcon}
              tooltip="描述分镜的视觉内容、构图、光线、色调等元素"
              saveStatus={saveStatus}
            >
              <EditableTextarea
                value={formData.visualDescription}
                onChange={(value) => setFormData({ ...formData, visualDescription: value })}
                placeholder="描述画面内容..."
                emptyText="点击添加画面描述"
                rows={2}
                minHeight="min-h-[60px]"
                textareaClassName="text-xs"
              />
            </EditableField>
          </div>

          {/* 景别和运镜 */}
          <div className="space-y-2 flex-shrink-0">
            {/* 景别选择 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <label className="text-xs font-medium text-muted-foreground">景别</label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-muted-foreground/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px]">
                      选择镜头的景别，如特写、近景、中景、全景等
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.shotSize}
                  onValueChange={(value) => setFormData({ ...formData, shotSize: value as ShotSize })}
                >
                  <SelectTrigger className="h-7 w-auto text-xs font-medium border-0 bg-transparent hover:bg-muted px-2">
                    <SelectValue placeholder="选择景别" />
                  </SelectTrigger>
                  <SelectContent className="shadow-none">
                    {shotSizeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-xs font-medium">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 运镜选择 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-muted-foreground" />
                  <label className="text-xs font-medium text-muted-foreground">运镜</label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-muted-foreground/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px]">
                      选择镜头的运动方式，如固定、推拉、摇移、跟随等
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.cameraMovement}
                  onValueChange={(value) => setFormData({ ...formData, cameraMovement: value as CameraMovement })}
                >
                  <SelectTrigger className="h-7 w-auto text-xs font-medium border-0 bg-transparent hover:bg-muted px-2">
                    <SelectValue placeholder="选择运镜" />
                  </SelectTrigger>
                  <SelectContent className="shadow-none">
                    {cameraMovementOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-xs font-medium">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 角色列表 */}
          <div className="space-y-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <label className="text-xs font-medium text-muted-foreground">角色</label>
                <Badge variant="secondary" className="h-4 text-xs">
                  {shot.shotCharacters.length}
                </Badge>
              </div>
              {availableCharacters.length > 0 && (
                <Select onValueChange={handleAddCharacter} disabled={addingCharacter}>
                  <SelectTrigger className="h-6 w-auto text-xs border-0 bg-transparent hover:bg-muted px-2">
                    <Plus className="w-3 h-3 mr-1" />
                    <span>添加</span>
                  </SelectTrigger>
                  <SelectContent>
                    {availableCharacters.map((character) => {
                      // 如果角色有多个造型，显示子选项
                      if (character.images.length > 0) {
                        return (
                          <div key={character.id}>
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                              {character.name}
                            </div>
                            {character.images.map((image) => (
                              <SelectItem
                                key={`${character.id}:${image.id}`}
                                value={`${character.id}:${image.id}`}
                                className="text-xs pl-6"
                              >
                                <div className="flex items-center gap-2">
                                  <Avatar className="w-4 h-4">
                                    <AvatarImage src={image.imageUrl || undefined} />
                                    <AvatarFallback className="text-xs">
                                      {character.name[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{image.label}</span>
                                  {image.isPrimary && (
                                    <Badge variant="secondary" className="h-3 text-xs">
                                      主
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </div>
                        );
                      }
                      // 如果角色没有造型，直接显示角色
                      return (
                        <SelectItem key={character.id} value={character.id} className="text-xs">
                          {character.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            {shot.shotCharacters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {shot.shotCharacters.map((sc) => (
                  <div
                    key={sc.id}
                    className="group/char relative flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={sc.characterImage?.imageUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {sc.character.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{sc.character.name}</span>
                    <button
                      onClick={() => handleRemoveCharacter(sc.id)}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover/char:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 对话列表 */}
          <div className="space-y-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                <label className="text-xs font-medium text-muted-foreground">对话</label>
                <Badge variant="secondary" className="h-4 text-xs">
                  {shot.dialogues.length}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddDialogue}
                className="h-6 px-2 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                添加
              </Button>
            </div>

            {shot.dialogues.length > 0 && (
              <div className="space-y-2">
                {shot.dialogues.map((dialogue) => (
                  <DialogueEditor
                    key={dialogue.id}
                    dialogue={dialogue}
                    characters={characters}
                    onUpdate={onUpdate}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 时长 */}
          <div className="flex items-center gap-2 pt-2 border-t flex-shrink-0">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="flex items-center gap-1">
                <Input 
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseFloat(e.target.value) || 0 })}
                    className="h-6 w-16 text-xs text-right p-1 border-transparent bg-transparent hover:bg-background hover:border-input focus:bg-background focus:border-input transition-colors"
                />
                <span className="text-xs text-muted-foreground">秒</span>
            </div>
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除分镜 #{shot.order} 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
