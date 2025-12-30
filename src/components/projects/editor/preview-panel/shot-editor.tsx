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
  ChevronLeft,
  ChevronRight,
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
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ShotAssetGallery } from "./shot-asset-gallery";

interface ShotEditorProps {
  shot: ShotDetail;
}

export function ShotEditor({ shot }: ShotEditorProps) {
  const { updateShot, state } = useEditor();
  const { project } = state;
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
  
  // 主预览区当前显示的图片索引
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);

  // 获取关联的素材列表
  const shotAssets = shot.shotAssets || [];
  const hasImage = shotAssets.length > 0 && !!shotAssets[0]?.asset?.imageUrl;
  const currentPreviewAsset = shotAssets[currentPreviewIndex];

  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const savedTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const shotSizeOptions = getShotSizeOptions();
  const cameraMovementOptions = getCameraMovementOptions();

  // 重置预览索引当素材列表变化时
  useEffect(() => {
    if (currentPreviewIndex >= shotAssets.length && shotAssets.length > 0) {
      setCurrentPreviewIndex(shotAssets.length - 1);
    } else if (shotAssets.length === 0) {
      setCurrentPreviewIndex(0);
    }
  }, [shotAssets.length, currentPreviewIndex]);

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
      if ((task.status !== "processing" && task.status !== "pending") || !task.inputData) return false;
      try {
        const inputData = JSON.parse(task.inputData);
        return inputData.shotId === shot.id;
      } catch {
        return false;
      }
    });
    
    if (activeTask) {
      setIsGeneratingVideo(true);
      if (activeTask.id) {
        setVideoGenerationJobId(activeTask.id);
      }
    } else {
      setIsGeneratingVideo(false);
      setVideoGenerationJobId(null);
    }
  }, [videoGenerationTasks, shot.id]);

  // 处理生成视频
  const handleGenerateVideo = async () => {
    if (!hasImage) {
      toast.error(tToast("error.generateShotImageFirst"));
      return;
    }

    setIsGeneratingVideo(true);
    try {
      const result = await generateShotVideo(shot.id);
      if (result.success && result.jobId) {
        setVideoGenerationJobId(result.jobId);
        toast.success(tToast("success.videoTaskStarted"));
      } else {
        toast.error(result.error || "启动失败");
        setIsGeneratingVideo(false);
      }
    } catch {
      toast.error(tToast("error.generationFailed"));
      setIsGeneratingVideo(false);
    }
  };

  // 处理画廊更新后的回调
  const handleGalleryUpdate = async () => {
    const refreshResult = await refreshShot(shot.id);
    if (refreshResult.success && refreshResult.shot) {
      updateShot(refreshResult.shot);
    }
  };

  // 切换预览图片
  const handlePrevImage = () => {
    setCurrentPreviewIndex((prev) => (prev > 0 ? prev - 1 : shotAssets.length - 1));
  };

  const handleNextImage = () => {
    setCurrentPreviewIndex((prev) => (prev < shotAssets.length - 1 ? prev + 1 : 0));
  };

  // 监听视频生成任务完成状态
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
  }, [videoGenerationTasks, shot.id, videoGenerationJobId, isGeneratingVideo, tToast]);

  // 获取当前视频生成任务的进度
  const currentVideoTask = videoGenerationTasks.find((task) => task.id === videoGenerationJobId);
  const videoGenerationProgress = currentVideoTask?.progress || 0;
  const videoGenerationMessage = currentVideoTask?.progressMessage || "正在生成视频...";

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 @container">
        {/* 标题栏 */}
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-lg px-3 py-1">
            #{shot.order}
          </Badge>
          <h2 className="text-xl font-semibold">分镜编辑</h2>
        </div>

        {/* 主预览区 */}
        <div className="space-y-4">
          <div className="aspect-video bg-muted rounded-lg overflow-hidden border flex items-center justify-center relative group">
            {currentPreviewAsset?.asset?.imageUrl ? (
              <>
                <Image
                  src={currentPreviewAsset.asset.imageUrl}
                  alt={`分镜 ${shot.order} - ${currentPreviewAsset.label}`}
                  fill
                  className="object-contain"
                  sizes="800px"
                />
                
                {/* 图片指示器和切换按钮 */}
                {shotAssets.length > 1 && (
                  <>
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded text-xs font-medium">
                      {currentPreviewIndex + 1} / {shotAssets.length}
                    </div>
                    
                    {/* 左右切换按钮 */}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={handlePrevImage}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={handleNextImage}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </>
                )}

                {/* 标签显示 */}
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded text-xs">
                  {currentPreviewAsset.label}
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground p-6">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm mb-3">暂无图片</p>
                <p className="text-xs">在下方画廊中添加图片</p>
              </div>
            )}
          </div>

          {/* 视频预览区域 */}
          <div className="space-y-2">
            {shot.currentVideo?.videoUrl ? (
              <>
                <video
                  src={shot.currentVideo.videoUrl}
                  controls
                  className="w-full rounded-lg border"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
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
              </>
            ) : isGeneratingVideo ? (
              <div className="text-center p-6 border rounded-lg bg-muted/30">
                <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-primary" />
                <p className="text-sm font-medium mb-2">{videoGenerationMessage}</p>
                <Progress value={videoGenerationProgress} className="w-full max-w-[200px] mx-auto" />
                <p className="text-xs text-muted-foreground mt-2">{videoGenerationProgress}%</p>
              </div>
            ) : hasImage ? (
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

        {/* 图片画廊 */}
        <ShotAssetGallery
          shotId={shot.id}
          projectId={project?.id || ""}
          shotAssets={shotAssets}
          onUpdate={handleGalleryUpdate}
        />

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
