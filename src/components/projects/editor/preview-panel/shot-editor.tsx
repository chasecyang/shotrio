"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ShotDetail, ShotSize, CameraMovement, EmotionTag } from "@/types/project";
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
import { 
  updateShot as updateShotAction, 
  generateShotImage, 
  updateShotCharacterImage,
  removeCharacterFromShot,
  updateShotDialogue,
  deleteShotDialogue,
  addCharacterToShot,
  addDialogueToShot,
} from "@/lib/actions/project";
import { generateShotVideo } from "@/lib/actions/video/generate";
import { createShotDecompositionJob } from "@/lib/actions/storyboard/decompose-shot";
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
  Scissors,
  Trash2,
  Plus,
  UserPlus,
  Smile,
  Frown,
  Angry,
  AlertCircle,
  Ghost,
  ThumbsDown,
  Meh,
} from "lucide-react";
import {
  EditableField,
  EditableTextarea,
  EditableInput,
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

// 情绪标签配置
const emotionOptions: { value: EmotionTag; label: string; icon: typeof Smile; color: string }[] = [
  { value: 'neutral', label: '平静', icon: Meh, color: 'text-gray-500' },
  { value: 'happy', label: '开心', icon: Smile, color: 'text-yellow-500' },
  { value: 'sad', label: '悲伤', icon: Frown, color: 'text-blue-500' },
  { value: 'angry', label: '愤怒', icon: Angry, color: 'text-red-500' },
  { value: 'surprised', label: '惊讶', icon: AlertCircle, color: 'text-purple-500' },
  { value: 'fearful', label: '恐惧', icon: Ghost, color: 'text-gray-700' },
  { value: 'disgusted', label: '厌恶', icon: ThumbsDown, color: 'text-green-700' },
];

export function ShotEditor({ shot }: ShotEditorProps) {
  const { state, openShotDecompositionDialog, updateShot } = useEditor();
  const { project } = state;

  const [formData, setFormData] = useState({
    shotSize: shot.shotSize,
    cameraMovement: shot.cameraMovement || "static",
    visualDescription: shot.visualDescription || "",
    duration: millisecondsToSeconds(shot.duration || 3000),
    sceneId: shot.sceneId || null,
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoGenerationJobId, setVideoGenerationJobId] = useState<string | null>(null);
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [decompositionJobId, setDecompositionJobId] = useState<string | null>(null);
  const [isAddingCharacter, setIsAddingCharacter] = useState(false);
  const [isAddingDialogue, setIsAddingDialogue] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const savedTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const shotSizeOptions = getShotSizeOptions();
  const cameraMovementOptions = getCameraMovementOptions();

  // 监听图片生成任务
  const { jobs } = useEditor();
  
  // 过滤出分镜图片生成任务 - 使用 useMemo 避免每次 render 都创建新数组
  const generationTasks = useMemo(() => 
    jobs?.filter((job) => job.type === "shot_image_generation") || [],
    [jobs]
  );

  // 过滤出分镜视频生成任务
  const videoGenerationTasks = useMemo(() =>
    jobs?.filter((job) => job.type === "shot_video_generation") || [],
    [jobs]
  );

  // 过滤出分镜拆解任务
  const decompositionTasks = useMemo(() =>
    jobs?.filter((job) => job.type === "shot_decomposition") || [],
    [jobs]
  );

  // 同步 shot 更新
  useEffect(() => {
    setFormData({
      shotSize: shot.shotSize,
      cameraMovement: shot.cameraMovement || "static",
      visualDescription: shot.visualDescription || "",
      duration: millisecondsToSeconds(shot.duration || 3000),
      sceneId: shot.sceneId || null,
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
      formData.duration !== millisecondsToSeconds(shot.duration || 3000) ||
      formData.sceneId !== (shot.sceneId || null);

    if (hasChanges) {
      setSaveStatus("idle");

      saveTimeoutRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          const result = await updateShotAction(shot.id, {
            shotSize: formData.shotSize,
            cameraMovement: formData.cameraMovement,
            visualDescription: formData.visualDescription || null,
            duration: secondsToMilliseconds(formData.duration),
            sceneId: formData.sceneId || null,
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

  // 检查是否有正在进行的生成任务
  useEffect(() => {
    const activeTask = generationTasks.find((task) => {
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
      setIsGenerating(true);
      if (activeTask.id) {
        setGenerationJobId(activeTask.id);
      }
    } else {
      // 没有活动任务时，重置状态
      setIsGenerating(false);
      setGenerationJobId(null);
    }
  }, [generationTasks, shot.id]);

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

  // 处理生成图片
  const handleGenerateImage = async () => {
    setIsGenerating(true);
    try {
      const result = await generateShotImage(shot.id);
      if (result.success && result.jobId) {
        setGenerationJobId(result.jobId);
        toast.success("已启动图片生成任务");
        // 不在这里重置状态，等待 useEffect 检测到任务后再处理
      } else {
        toast.error(result.error || "启动失败");
        setIsGenerating(false); // 失败时才重置
      }
    } catch {
      toast.error("生成失败");
      setIsGenerating(false); // 出错时才重置
    }
  };

  // 刷新当前分镜数据的辅助函数
  const refreshCurrentShot = async () => {
    const result = await refreshShot(shot.id);
    if (result.success && result.shot) {
      updateShot(result.shot);
    }
  };

  // 处理造型切换
  const handleChangeCharacterImage = async (shotCharacterId: string, characterImageId: string) => {
    try {
      const result = await updateShotCharacterImage(shotCharacterId, characterImageId);
      if (result.success) {
        toast.success("造型已更新");
        await refreshCurrentShot();
      } else {
        toast.error(result.error || "更新失败");
      }
    } catch {
      toast.error("更新失败");
    }
  };

  // 处理删除角色
  const handleRemoveCharacter = async (shotCharacterId: string) => {
    try {
      const result = await removeCharacterFromShot(shotCharacterId);
      if (result.success) {
        toast.success("已移除角色");
        await refreshCurrentShot();
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  // 处理更新对话内容
  const handleUpdateDialogue = async (dialogueId: string, dialogueText: string) => {
    try {
      const result = await updateShotDialogue(dialogueId, { dialogueText });
      if (result.success) {
        await refreshCurrentShot();
      } else {
        toast.error(result.error || "更新失败");
      }
    } catch {
      toast.error("更新失败");
    }
  };

  // 处理更新对话角色
  const handleUpdateDialogueCharacter = async (dialogueId: string, characterId: string | null) => {
    try {
      const result = await updateShotDialogue(dialogueId, { 
        characterId: characterId || null 
      });
      if (result.success) {
        await refreshCurrentShot();
      } else {
        toast.error(result.error || "更新失败");
      }
    } catch {
      toast.error("更新失败");
    }
  };

  // 处理更新对话情绪
  const handleUpdateDialogueEmotion = async (dialogueId: string, emotionTag: EmotionTag | null) => {
    try {
      const result = await updateShotDialogue(dialogueId, { 
        emotionTag: emotionTag || null 
      });
      if (result.success) {
        await refreshCurrentShot();
      } else {
        toast.error(result.error || "更新失败");
      }
    } catch {
      toast.error("更新失败");
    }
  };

  // 处理删除对话
  const handleDeleteDialogue = async (dialogueId: string) => {
    try {
      const result = await deleteShotDialogue(dialogueId);
      if (result.success) {
        toast.success("已删除对话");
        await refreshCurrentShot();
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  // 处理添加角色
  const handleAddCharacter = async (characterId: string) => {
    setIsAddingCharacter(true);
    try {
      const result = await addCharacterToShot({
        shotId: shot.id,
        characterId,
      });
      if (result.success) {
        toast.success("已添加角色");
        await refreshCurrentShot();
      } else {
        toast.error(result.error || "添加失败");
      }
    } catch {
      toast.error("添加失败");
    } finally {
      setIsAddingCharacter(false);
    }
  };

  // 处理添加对话
  const handleAddDialogue = async () => {
    setIsAddingDialogue(true);
    try {
      const result = await addDialogueToShot({
        shotId: shot.id,
        dialogueText: "",
      });
      if (result.success) {
        toast.success("已添加对话");
        await refreshCurrentShot();
      } else {
        toast.error(result.error || "添加失败");
      }
    } catch {
      toast.error("添加失败");
    } finally {
      setIsAddingDialogue(false);
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
        // 不在这里重置状态，等待 useEffect 检测到任务后再处理
      } else {
        toast.error(result.error || "启动失败");
        setIsGeneratingVideo(false); // 失败时才重置
      }
    } catch {
      toast.error("生成失败");
      setIsGeneratingVideo(false); // 出错时才重置
    }
  };

  // 处理分镜拆解
  const handleDecompose = async () => {
    if (!shot.episodeId) {
      toast.error("无法获取剧集信息");
      return;
    }

    setIsDecomposing(true);
    try {
      const result = await createShotDecompositionJob({
        shotId: shot.id,
        episodeId: shot.episodeId,
      });

      if (result.success && result.jobId) {
        setDecompositionJobId(result.jobId);
        toast.success("已启动分镜拆解任务");
      } else {
        toast.error(result.error || "启动失败");
        setIsDecomposing(false);
      }
    } catch {
      toast.error("启动失败");
      setIsDecomposing(false);
    }
  };

  // 监听拆解任务状态
  useEffect(() => {
    const activeTask = decompositionTasks.find((task) => {
      const inputData = task.inputData ? JSON.parse(task.inputData) : {};
      return inputData.shotId === shot.id && task.status !== "failed" && task.status !== "cancelled";
    });

    if (activeTask?.status === "completed" && activeTask.id === decompositionJobId) {
      // 任务完成，打开预览对话框
      setIsDecomposing(false);
      openShotDecompositionDialog(shot.id, activeTask.id);
    } else if (activeTask?.status === "failed") {
      setIsDecomposing(false);
      toast.error(activeTask.errorMessage || "拆解失败");
    } else {
      setIsDecomposing(!!activeTask);
    }
  }, [decompositionTasks, shot.id, decompositionJobId, openShotDecompositionDialog]);

  // 监听图片生成任务完成状态（只用于显示提示和重置 UI 状态）
  // 数据刷新由 EditorContext 中的统一刷新机制处理
  useEffect(() => {
    const relevantJob = generationTasks.find((task) => {
      if (!task.inputData) return false;
      if (task.status !== "completed" && task.status !== "failed") return false;
      try {
        const inputData = JSON.parse(task.inputData);
        return inputData.shotId === shot.id;
      } catch {
        return false;
      }
    });

    if (relevantJob && (relevantJob.id === generationJobId || isGenerating)) {
      if (relevantJob.status === "completed") {
        setIsGenerating(false);
        setGenerationJobId(null);
        toast.success("图片生成完成");
      } else if (relevantJob.status === "failed") {
        setIsGenerating(false);
        setGenerationJobId(null);
        toast.error(relevantJob.errorMessage || "图片生成失败");
      }
    }
  }, [generationTasks, shot.id, generationJobId, isGenerating]);

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
        toast.success("视频生成完成");
      } else if (relevantJob.status === "failed") {
        setIsGeneratingVideo(false);
        setVideoGenerationJobId(null);
        toast.error(relevantJob.errorMessage || "视频生成失败");
      }
    }
  }, [videoGenerationTasks, shot.id, videoGenerationJobId, isGeneratingVideo]);

  // 获取当前生成任务的进度
  // 优先查找匹配当前分镜的任务，如果没有则使用 jobId
  const currentTask = generationTasks.find((task) => {
    if (!task.inputData) return false;
    try {
      const inputData = JSON.parse(task.inputData);
      return inputData.shotId === shot.id && 
             (task.status === "processing" || task.status === "pending");
    } catch {
      return false;
    }
  }) || generationTasks.find((task) => task.id === generationJobId);
  
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
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 大图预览 */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="aspect-video bg-muted rounded-lg overflow-hidden border flex items-center justify-center relative">
              {shot.imageUrl && !isGenerating ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shot.imageUrl}
                    alt={`分镜 ${shot.order}`}
                    className="w-full h-full object-contain"
                  />
                  {/* 重新生成按钮 */}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2 gap-1.5"
                    onClick={handleGenerateImage}
                    disabled={isGenerating}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    重新生成
                  </Button>
                </>
              ) : isGenerating ? (
                <div className="text-center p-6 w-full">
                  {shot.imageUrl && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shot.imageUrl}
                        alt={`分镜 ${shot.order}`}
                        className="w-full h-full object-contain absolute inset-0 opacity-50"
                      />
                      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center" />
                    </>
                  )}
                  <div className="relative z-10">
                    <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin text-primary" />
                    <p className="text-sm font-medium mb-2">{generationMessage}</p>
                    <Progress value={generationProgress} className="w-full max-w-[200px] mx-auto" />
                    <p className="text-xs text-muted-foreground mt-2">{generationProgress}%</p>
                  </div>
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

        {/* 关联场景 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">关联场景</h3>
          </div>
          
          {project?.scenes && project.scenes.length > 0 ? (
            <Select
              value={formData.sceneId || "none"}
              onValueChange={(value) =>
                setFormData({ ...formData, sceneId: value === "none" ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="选择场景">
                  {formData.sceneId 
                    ? project.scenes.find((s) => s.id === formData.sceneId)?.name 
                    : "未关联场景"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">未关联场景</span>
                </SelectItem>
                {project.scenes.map((scene) => (
                  <SelectItem key={scene.id} value={scene.id}>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{scene.name}</span>
                      {scene.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {scene.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">
              暂无场景，请先在资源面板中创建场景
            </p>
          )}

          {/* 当前关联的场景信息 */}
          {formData.sceneId && shot.scene && (
            <div className="p-3 rounded-lg border bg-muted/30">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{shot.scene.name}</span>
                  </div>
                  {shot.scene.description && (
                    <p className="text-xs text-muted-foreground">
                      {shot.scene.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
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
                    className="group relative flex items-center gap-3 p-3 rounded-lg bg-muted/50 border"
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
                    {/* 删除按钮 */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveCharacter(sc.id)}
                      title="移除角色"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无角色</p>
          )}

          {/* 添加角色按钮 */}
          {project?.characters && project.characters.length > 0 && (
            <Select onValueChange={handleAddCharacter} disabled={isAddingCharacter}>
              <SelectTrigger className="w-full">
                <div className="flex items-center gap-2">
                  {isAddingCharacter ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  <span>添加角色</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {project.characters
                  .filter((char) => !shot.shotCharacters.some((sc) => sc.characterId === char.id))
                  .map((char) => (
                    <SelectItem key={char.id} value={char.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-xs">
                            {char.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span>{char.name}</span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
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
                const emotion = emotionOptions.find((e) => e.value === dialogue.emotionTag);
                const EmotionIcon = emotion?.icon || Meh;
                
                return (
                  <div
                    key={dialogue.id}
                    className="group relative flex flex-col gap-2 p-3 rounded-lg bg-muted/50 border"
                  >
                    {/* 角色和情绪选择 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* 角色选择 */}
                      {character ? (
                        <Avatar className="w-6 h-6 shrink-0">
                          <AvatarFallback className="text-xs">
                            {character.name[0]}
                          </AvatarFallback>
                        </Avatar>
                      ) : null}
                      {project?.characters && project.characters.length > 0 && (
                        <Select
                          value={dialogue.characterId || "none"}
                          onValueChange={(value) => 
                            handleUpdateDialogueCharacter(dialogue.id, value === "none" ? null : value)
                          }
                        >
                          <SelectTrigger className="h-7 text-xs w-fit">
                            <SelectValue placeholder="选择角色">
                              {character ? character.name : "旁白/无角色"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground">旁白/无角色</span>
                            </SelectItem>
                            {project.characters.map((char) => (
                              <SelectItem key={char.id} value={char.id}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="w-6 h-6">
                                    <AvatarFallback className="text-xs">
                                      {char.name[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{char.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      
                      {/* 情绪选择 */}
                      <Select
                        value={dialogue.emotionTag || "neutral"}
                        onValueChange={(value) => 
                          handleUpdateDialogueEmotion(dialogue.id, value as EmotionTag)
                        }
                      >
                        <SelectTrigger className="h-7 text-xs w-fit">
                          <div className="flex items-center gap-1.5">
                            <EmotionIcon className={`w-3.5 h-3.5 ${emotion?.color || 'text-muted-foreground'}`} />
                            <span>{emotion?.label || '平静'}</span>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {emotionOptions.map((opt) => {
                            const Icon = opt.icon;
                            return (
                              <SelectItem key={opt.value} value={opt.value}>
                                <div className="flex items-center gap-2">
                                  <Icon className={`w-4 h-4 ${opt.color}`} />
                                  <span>{opt.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* 对话内容 */}
                    <div className="flex-1 min-w-0">
                      <EditableInput
                        value={dialogue.dialogueText || ""}
                        onChange={(value) => handleUpdateDialogue(dialogue.id, value)}
                        placeholder="输入对话内容..."
                        emptyText="点击添加对话内容"
                        className="!p-0 !border-0 hover:bg-muted/50"
                        inputClassName="text-sm"
                      />
                    </div>
                    
                    {/* 删除按钮 */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteDialogue(dialogue.id)}
                      title="删除对话"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无对话</p>
          )}

          {/* 添加对话按钮 */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={handleAddDialogue}
            disabled={isAddingDialogue}
          >
            {isAddingDialogue ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            添加对话
          </Button>
        </div>

        {/* 分镜拆解按钮 */}
        {(shot.dialogues.length >= 2 || (shot.duration && shot.duration >= 8000)) && (
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleDecompose}
              disabled={isDecomposing}
            >
              {isDecomposing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI 正在分析拆解方案...
                </>
              ) : (
                <>
                  <Scissors className="w-4 h-4" />
                  <Sparkles className="w-4 h-4" />
                  拆解分镜
                </>
              )}
            </Button>
            {(shot.dialogues.length >= 2) && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                此分镜包含多个对话，可拆解为多个小分镜
              </p>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

