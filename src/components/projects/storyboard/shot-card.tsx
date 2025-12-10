"use client";

import { ShotDetail, ShotSize, CameraMovement } from "@/types/project";
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
import { Image as ImageIcon, Clock, MessageSquare, Trash2, GripVertical } from "lucide-react";
import { 
  getShotSizeOptions, 
  getCameraMovementOptions,
  millisecondsToSeconds, 
  secondsToMilliseconds 
} from "@/lib/utils/shot-utils";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { deleteShot, updateShot } from "@/lib/actions/project";
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

interface ShotCardProps {
  shot: ShotDetail;
  onUpdate: () => void;
}

export function ShotCard({ shot, onUpdate }: ShotCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // 编辑状态
  const [formData, setFormData] = useState({
    shotSize: shot.shotSize,
    cameraMovement: shot.cameraMovement || "static",
    visualDescription: shot.visualDescription || "",
    dialogue: shot.dialogue || "",
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
    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 检查是否有更改
    const hasChanges =
      formData.shotSize !== shot.shotSize ||
      formData.cameraMovement !== (shot.cameraMovement || "static") ||
      formData.visualDescription !== (shot.visualDescription || "") ||
      formData.dialogue !== (shot.dialogue || "") ||
      formData.duration !== millisecondsToSeconds(shot.duration || 3000);

    if (hasChanges) {
      setSaveStatus("idle");
      
      // 1秒后自动保存
      saveTimeoutRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          const result = await updateShot(shot.id, {
            shotSize: formData.shotSize,
            cameraMovement: formData.cameraMovement,
            visualDescription: formData.visualDescription || null,
            dialogue: formData.dialogue || null,
            duration: secondsToMilliseconds(formData.duration),
          });

          if (result.success) {
            setSaveStatus("saved");
            
            // 3秒后隐藏"已保存"状态
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

  // 清理定时器
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
  
  const shotSizeOptions = getShotSizeOptions();
  const cameraMovementOptions = getCameraMovementOptions();

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "border rounded-lg bg-card overflow-hidden transition-all hover:ring-2 hover:ring-primary/30 flex flex-col h-full",
          isDragging && "opacity-50 z-50"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 顶部：镜号 + 景别 + 运镜 + 删除 */}
        <div className="p-2 border-b bg-muted/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
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
            
            {/* 景别选择 */}
            <Select
                value={formData.shotSize}
                onValueChange={(value) => setFormData({ ...formData, shotSize: value as ShotSize })}
            >
                <SelectTrigger className="h-6 text-xs border-transparent bg-transparent hover:bg-background hover:border-input px-2 w-auto min-w-[60px] p-0 gap-1 focus:ring-0">
                    <SelectValue placeholder="景别" />
                </SelectTrigger>
                <SelectContent>
                    {shotSizeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs">
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* 运镜选择 */}
            <Select
                value={formData.cameraMovement}
                onValueChange={(value) => setFormData({ ...formData, cameraMovement: value as CameraMovement })}
            >
                <SelectTrigger className="h-6 text-xs border-transparent bg-transparent hover:bg-background hover:border-input px-2 w-auto min-w-[70px] p-0 gap-1 focus:ring-0">
                    <SelectValue placeholder="运镜" />
                </SelectTrigger>
                <SelectContent>
                    {cameraMovementOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs">
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
             {isHovered && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteClick}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
             )}
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
        <div className="p-3 space-y-3 flex-1 flex flex-col">
          {/* 视觉描述 */}
          <div className="flex-1">
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

          {/* 台词 */}
          <div className="flex-1">
            <EditableField
              label="台词"
              icon={MessageSquare}
              tooltip="角色在此镜头中的对话或旁白"
              saveStatus={saveStatus}
            >
              <EditableTextarea
                value={formData.dialogue}
                onChange={(value) => setFormData({ ...formData, dialogue: value })}
                placeholder="输入台词..."
                emptyText="点击添加台词"
                rows={2}
                minHeight="min-h-[40px]"
                textareaClassName="text-xs"
              />
            </EditableField>
          </div>

          {/* 时长 */}
          <div className="flex items-center gap-2 pt-2 border-t">
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


