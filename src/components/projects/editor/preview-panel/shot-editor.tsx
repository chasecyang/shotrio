"use client";

import { useState, useRef, useEffect } from "react";
import { ShotDetail, ShotSize, CameraMovement } from "@/types/project";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { updateShot } from "@/lib/actions/project";
import { toast } from "sonner";
import {
  Image as ImageIcon,
  Clock,
  Users,
  MessageSquare,
  Maximize2,
  Video,
  MapPin,
  Sparkles,
} from "lucide-react";
import {
  EditableField,
  EditableTextarea,
  SaveStatus,
} from "@/components/ui/inline-editable-field";
import {
  getShotSizeOptions,
  getCameraMovementOptions,
  millisecondsToSeconds,
  secondsToMilliseconds,
} from "@/lib/utils/shot-utils";
import { useEditor } from "../editor-context";

interface ShotEditorProps {
  shot: ShotDetail;
}

export function ShotEditor({ shot }: ShotEditorProps) {
  const { state, dispatch } = useEditor();
  const { project } = state;

  const [formData, setFormData] = useState({
    shotSize: shot.shotSize,
    cameraMovement: shot.cameraMovement || "static",
    visualDescription: shot.visualDescription || "",
    duration: millisecondsToSeconds(shot.duration || 3000),
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const savedTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const shotSizeOptions = getShotSizeOptions();
  const cameraMovementOptions = getCameraMovementOptions();

  // 同步 shot 更新
  useEffect(() => {
    setFormData({
      shotSize: shot.shotSize,
      cameraMovement: shot.cameraMovement || "static",
      visualDescription: shot.visualDescription || "",
      duration: millisecondsToSeconds(shot.duration || 3000),
    });
  }, [shot]);

  // 自动保存
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
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* 顶部：分镜预览图 */}
        <div className="flex gap-6">
          {/* 大图预览 */}
          <div className="w-80 shrink-0">
            <div className="aspect-video bg-muted rounded-lg overflow-hidden border flex items-center justify-center">
              {shot.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shot.imageUrl}
                  alt={`分镜 ${shot.order}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无图片</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => toast.info("图片生成功能开发中...")}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                    生成图片
                  </Button>
                </div>
              )}
            </div>

            {/* 视频预览（如果有） */}
            {shot.videoUrl && (
              <div className="mt-3">
                <video
                  src={shot.videoUrl}
                  controls
                  className="w-full rounded-lg"
                />
              </div>
            )}
          </div>

          {/* 右侧：基本信息 */}
          <div className="flex-1 space-y-4">
            {/* 标题栏 */}
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono text-lg px-3 py-1">
                #{shot.order}
              </Badge>
              <h2 className="text-xl font-semibold">分镜编辑</h2>
            </div>

            {/* 场景信息 */}
            {shot.scene && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>场景：{shot.scene.name}</span>
              </div>
            )}

            {/* 景别和运镜选择器 */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Maximize2 className="w-4 h-4 text-muted-foreground" />
                  景别
                </label>
                <Select
                  value={formData.shotSize}
                  onValueChange={(value) =>
                    setFormData({ ...formData, shotSize: value as ShotSize })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择景别" />
                  </SelectTrigger>
                  <SelectContent>
                    {shotSizeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-muted-foreground" />
                  运镜
                </label>
                <Select
                  value={formData.cameraMovement}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      cameraMovement: value as CameraMovement,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择运镜" />
                  </SelectTrigger>
                  <SelectContent>
                    {cameraMovementOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 时长 */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-muted-foreground" />
                时长
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      duration: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">秒</span>
              </div>
            </div>
          </div>
        </div>

        {/* 画面描述 */}
        <div>
          <EditableField
            label="画面描述"
            icon={ImageIcon}
            saveStatus={saveStatus}
          >
            <EditableTextarea
              value={formData.visualDescription}
              onChange={(value) =>
                setFormData({ ...formData, visualDescription: value })
              }
              placeholder="描述画面内容、构图、光线、色调等..."
              emptyText="点击添加画面描述"
              rows={4}
            />
          </EditableField>
        </div>

        {/* 角色列表 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">出场角色</h3>
            <Badge variant="secondary">{shot.shotCharacters.length}</Badge>
          </div>

          {shot.shotCharacters.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {shot.shotCharacters.map((sc) => (
                <div
                  key={sc.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={sc.characterImage?.imageUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {sc.character.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{sc.character.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无角色</p>
          )}
        </div>

        {/* 对话列表 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">对话</h3>
            <Badge variant="secondary">{shot.dialogues.length}</Badge>
          </div>

          {shot.dialogues.length > 0 ? (
            <div className="space-y-2">
              {shot.dialogues.map((dialogue) => {
                const character = project?.characters.find(
                  (c) => c.id === dialogue.characterId
                );
                return (
                  <div
                    key={dialogue.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border"
                  >
                    {character && (
                      <Avatar className="w-6 h-6 shrink-0">
                        <AvatarFallback className="text-xs">
                          {character.name[0]}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1 min-w-0">
                      {character && (
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">
                          {character.name}
                        </p>
                      )}
                      <p className="text-sm">{dialogue.dialogueText || "（空白对话）"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无对话</p>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

