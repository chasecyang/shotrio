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
import { updateShot, generateShotImage, updateShotCharacterImage } from "@/lib/actions/project";
import { generateShotVideo } from "@/lib/actions/video/generate";
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
  Loader2,
  RefreshCw,
  PlayIcon,
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
import { useTaskSubscription } from "@/hooks/use-task-subscription";
import { Progress } from "@/components/ui/progress";

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoGenerationJobId, setVideoGenerationJobId] = useState<string | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const savedTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const shotSizeOptions = getShotSizeOptions();
  const cameraMovementOptions = getCameraMovementOptions();

  // 监听图片生成任务
  const { jobs } = useTaskSubscription();
  
  // 过滤出分镜图片生成任务
  const generationTasks = jobs?.filter(
    (job) => job.type === "shot_image_generation"
  ) || [];

  // 过滤出分镜视频生成任务
  const videoGenerationTasks = jobs?.filter(
    (job) => job.type === "shot_video_generation"
  ) || [];

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

  // 检查是否有正在进行的生成任务
  useEffect(() => {
    const activeTask = generationTasks.find((task) => {
      if (task.status !== "processing" || !task.inputData) return false;
      try {
        const inputData = JSON.parse(task.inputData);
        return inputData.shotId === shot.id;
      } catch {
        return false;
      }
    });
    setIsGenerating(!!activeTask);
    if (activeTask?.id) {
      setGenerationJobId(activeTask.id);
    }
  }, [generationTasks, shot.id]);

  // 检查是否有正在进行的视频生成任务
  useEffect(() => {
    const activeTask = videoGenerationTasks.find((task) => {
      if (task.status !== "processing" || !task.inputData) return false;
      try {
        const inputData = JSON.parse(task.inputData);
        return inputData.shotId === shot.id;
      } catch {
        return false;
      }
    });
    setIsGeneratingVideo(!!activeTask);
    if (activeTask?.id) {
      setVideoGenerationJobId(activeTask.id);
    }
  }, [videoGenerationTasks, shot.id]);

  // 处理生成图片
  const handleGenerateImage = async () => {
    setIsGenerating(true);
    try {
      const result = await generateShotImage(shot.id);
      if (result.success && result.jobId) {
        setGenerationJobId(result.jobId);
        toast.success("已启动图片生成任务");
      } else {
        toast.error(result.error || "启动失败");
        setIsGenerating(false);
      }
    } catch (error) {
      toast.error("生成失败");
      setIsGenerating(false);
    }
  };

  // 处理造型切换
  const handleChangeCharacterImage = async (shotCharacterId: string, characterImageId: string) => {
    try {
      const result = await updateShotCharacterImage(shotCharacterId, characterImageId);
      if (result.success) {
        toast.success("造型已更新");
      } else {
        toast.error(result.error || "更新失败");
      }
    } catch (error) {
      toast.error("更新失败");
    }
  };

  // 处理生成视频
  const handleGenerateVideo = async () => {
    if (!shot.imageUrl) {
      toast.error("请先生成分镜图片");
      return;
    }

    setIsGeneratingVideo(true);
    try {
      const result = await generateShotVideo(shot.id);
      if (result.success && result.jobId) {
        setVideoGenerationJobId(result.jobId);
        toast.success("已启动视频生成任务");
      } else {
        toast.error(result.error || "启动失败");
        setIsGeneratingVideo(false);
      }
    } catch (error) {
      toast.error("生成失败");
      setIsGeneratingVideo(false);
    }
  };

  // 获取当前生成任务的进度
  const currentTask = generationTasks.find((task) => task.id === generationJobId);
  const generationProgress = currentTask?.progress || 0;
  const generationMessage = currentTask?.progressMessage || "正在生成...";

  // 获取当前视频生成任务的进度
  const currentVideoTask = videoGenerationTasks.find((task) => task.id === videoGenerationJobId);
  const videoGenerationProgress = currentVideoTask?.progress || 0;
  const videoGenerationMessage = currentVideoTask?.progressMessage || "正在生成视频...";

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* 顶部：分镜预览图 */}
        <div className="flex gap-6">
          {/* 大图预览 */}
          <div className="w-80 shrink-0">
            <div className="aspect-video bg-muted rounded-lg overflow-hidden border flex items-center justify-center relative">
              {shot.imageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shot.imageUrl}
                    alt={`分镜 ${shot.order}`}
                    className="w-full h-full object-cover"
                  />
                  {/* 重新生成按钮 */}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2 gap-1.5"
                    onClick={handleGenerateImage}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    重新生成
                  </Button>
                </>
              ) : isGenerating ? (
                <div className="text-center p-6">
                  <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin text-primary" />
                  <p className="text-sm font-medium mb-2">{generationMessage}</p>
                  <Progress value={generationProgress} className="w-full max-w-[200px] mx-auto" />
                  <p className="text-xs text-muted-foreground mt-2">{generationProgress}%</p>
                </div>
              ) : (
                <div className="text-center text-muted-foreground p-6">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm mb-3">暂无图片</p>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleGenerateImage}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    生成图片
                  </Button>
                </div>
              )}
            </div>

            {/* 视频预览区域 */}
            <div className="mt-3 space-y-2">
              {shot.videoUrl ? (
                <>
                  <video
                    src={shot.videoUrl}
                    controls
                    className="w-full rounded-lg border"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={handleGenerateVideo}
                      disabled={isGeneratingVideo}
                    >
                      {isGeneratingVideo ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      重新生成视频
                    </Button>
                  </div>
                </>
              ) : isGeneratingVideo ? (
                <div className="text-center p-6 border rounded-lg bg-muted/30">
                  <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-primary" />
                  <p className="text-sm font-medium mb-2">{videoGenerationMessage}</p>
                  <Progress value={videoGenerationProgress} className="w-full max-w-[200px] mx-auto" />
                  <p className="text-xs text-muted-foreground mt-2">{videoGenerationProgress}%</p>
                </div>
              ) : shot.imageUrl ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={handleGenerateVideo}
                >
                  <PlayIcon className="w-3.5 h-3.5" />
                  <Sparkles className="w-3.5 h-3.5" />
                  生成视频
                </Button>
              ) : null}
            </div>
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
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{shot.scene.name}</span>
                    </div>
                    {shot.scene.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {shot.scene.description}
                      </p>
                    )}
                  </div>
                </div>
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
            <div className="grid gap-3 sm:grid-cols-2">
              {shot.shotCharacters.map((sc) => {
                // 获取该角色的所有造型
                const allCharacterImages = project?.characters
                  .find((c) => c.id === sc.characterId)
                  ?.images || [];

                return (
                  <div
                    key={sc.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border"
                  >
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarImage src={sc.characterImage?.imageUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {sc.character.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{sc.character.name}</p>
                      {allCharacterImages.length > 0 ? (
                        <Select
                          value={sc.characterImageId || ""}
                          onValueChange={(value) => handleChangeCharacterImage(sc.id, value)}
                        >
                          <SelectTrigger className="h-7 text-xs mt-1">
                            <SelectValue placeholder="选择造型" />
                          </SelectTrigger>
                          <SelectContent>
                            {allCharacterImages.map((img) => (
                              <SelectItem key={img.id} value={img.id}>
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded overflow-hidden bg-muted shrink-0">
                                    {img.imageUrl && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={img.imageUrl}
                                        alt={img.label}
                                        className="w-full h-full object-cover"
                                      />
                                    )}
                                  </div>
                                  <span>{img.label}</span>
                                  {img.isPrimary && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                                      主
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">无造型</p>
                      )}
                    </div>
                  </div>
                );
              })}
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

