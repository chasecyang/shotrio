"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
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
import { 
  updateShot as updateShotAction, 
} from "@/lib/actions/project";
import { generateShotVideo } from "@/lib/actions/video/generate";
import { toast } from "sonner";
import {
  Image as ImageIcon,
  Clock,
  Maximize2,
  Video,
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
import { Progress } from "@/components/ui/progress";
import { refreshShot } from "@/lib/actions/project/refresh";

interface ShotEditorProps {
  shot: ShotDetail;
}

export function ShotEditor({ shot }: ShotEditorProps) {
  const { updateShot } = useEditor();
  const tToast = useTranslations("toasts");

  const [formData, setFormData] = useState({
    shotSize: shot.shotSize,
    cameraMovement: shot.cameraMovement || "static",
    description: shot.description || "",
    duration: millisecondsToSeconds(shot.duration || 3000),
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoGenerationJobId, setVideoGenerationJobId] = useState<string | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const savedTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const shotSizeOptions = getShotSizeOptions();
  const cameraMovementOptions = getCameraMovementOptions();

  // 监听视频生成任务
  const { jobs } = useEditor();

  // 过滤出分镜视频生成任务
  const videoGenerationTasks = useMemo(() =>
    jobs?.filter((job) => job.type === "shot_video_generation") || [],
    [jobs]
  );

  // 同步 shot 更新
  useEffect(() => {
    setFormData({
      shotSize: shot.shotSize,
      cameraMovement: shot.cameraMovement || "static",
      description: shot.description || "",
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
      formData.description !== (shot.description || "") ||
      formData.duration !== millisecondsToSeconds(shot.duration || 3000);

    if (hasChanges) {
      setSaveStatus("idle");

      saveTimeoutRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          const result = await updateShotAction(shot.id, {
            shotSize: formData.shotSize,
            cameraMovement: formData.cameraMovement,
            description: formData.description || null,
            duration: secondsToMilliseconds(formData.duration),
          });

          if (result.success) {
            setSaveStatus("saved");
            // 刷新分镜数据以确保 EditorContext 中的数据同步
            const refreshResult = await refreshShot(shot.id);
            if (refreshResult.success && refreshResult.shot) {
              updateShot(refreshResult.shot);
            }
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
  }, [formData, shot, updateShot]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  // 检查是否有正在进行的视频生成任务
  useEffect(() => {
    const activeTask = videoGenerationTasks.find((task) => {
      // 检查任务状态：pending 或 processing
      if ((task.status !== "processing" && task.status !== "pending") || !task.inputData) return false;
      try {
        const inputData = JSON.parse(task.inputData);
        return inputData.shotId === shot.id;
      } catch {
        return false;
      }
    });
    
    if (activeTask) {
      // 有活动任务时，设置状态和 jobId
      setIsGeneratingVideo(true);
      if (activeTask.id) {
        setVideoGenerationJobId(activeTask.id);
      }
    } else {
      // 没有活动任务时，重置状态
      setIsGeneratingVideo(false);
      setVideoGenerationJobId(null);
    }
  }, [videoGenerationTasks, shot.id]);

  // 处理生成视频
  const handleGenerateVideo = async () => {
    if (!shot.imageAsset?.imageUrl) {
      toast.error(tToast("error.generateShotImageFirst"));
      return;
    }

    setIsGeneratingVideo(true);
    try {
      const result = await generateShotVideo(shot.id);
      if (result.success && result.jobId) {
        setVideoGenerationJobId(result.jobId);
        toast.success(tToast("success.videoTaskStarted"));
        // 不在这里重置状态，等待 useEffect 检测到任务后再处理
      } else {
        toast.error(result.error || "启动失败");
        setIsGeneratingVideo(false); // 失败时才重置
      }
    } catch {
      toast.error(tToast("error.generationFailed"));
      setIsGeneratingVideo(false); // 出错时才重置
    }
  };

  // 监听视频生成任务完成状态（只用于显示提示和重置 UI 状态）
  useEffect(() => {
    const relevantJob = videoGenerationTasks.find((task) => {
      if (!task.inputData) return false;
      if (task.status !== "completed" && task.status !== "failed") return false;
      try {
        const inputData = JSON.parse(task.inputData);
        return inputData.shotId === shot.id;
      } catch {
        return false;
      }
    });

    if (relevantJob && (relevantJob.id === videoGenerationJobId || isGeneratingVideo)) {
      if (relevantJob.status === "completed") {
        setIsGeneratingVideo(false);
        setVideoGenerationJobId(null);
        toast.success(tToast("success.videoGenerated"));
      } else if (relevantJob.status === "failed") {
        setIsGeneratingVideo(false);
        setVideoGenerationJobId(null);
        toast.error(relevantJob.errorMessage || "视频生成失败");
      }
    }
  }, [videoGenerationTasks, shot.id, videoGenerationJobId, isGeneratingVideo]);

  // 获取当前视频生成任务的进度
  const currentVideoTask = videoGenerationTasks.find((task) => task.id === videoGenerationJobId);
  const videoGenerationProgress = currentVideoTask?.progress || 0;
  const videoGenerationMessage = currentVideoTask?.progressMessage || "正在生成视频...";

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* 顶部：分镜预览图 */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 大图预览 */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="aspect-video bg-muted rounded-lg overflow-hidden border flex items-center justify-center relative">
              {shot.imageAsset?.imageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shot.imageAsset.imageUrl}
                    alt={`分镜 ${shot.order}`}
                    className="w-full h-full object-contain"
                  />
                </>
              ) : (
                <div className="text-center text-muted-foreground p-6">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm mb-3">暂无图片</p>
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
              ) : shot.imageAsset?.imageUrl ? (
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

        {/* 内容描述 */}
        <div>
          <EditableField
            label="内容描述"
            icon={ImageIcon}
            saveStatus={saveStatus}
          >
            <EditableTextarea
              value={formData.description}
              onChange={(value) =>
                setFormData({ ...formData, description: value })
              }
              placeholder="描述画面内容、对话、动作、表情、情绪、构图、光线、色调等..."
              emptyText="点击添加内容描述"
              rows={4}
            />
          </EditableField>
        </div>
      </div>
    </ScrollArea>
  );
}

