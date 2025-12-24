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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ImagePlus,
  X,
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
import { queryAssets } from "@/lib/actions/asset";
import { AssetWithTags } from "@/types/asset";
import Image from "next/image";

interface ShotEditorProps {
  shot: ShotDetail;
}

export function ShotEditor({ shot }: ShotEditorProps) {
  const { updateShot, project } = useEditor();
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
  
  // 素材选择器状态
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
  const [assets, setAssets] = useState<AssetWithTags[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUpdatingAsset, setIsUpdatingAsset] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const savedTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const shotSizeOptions = getShotSizeOptions();
  const cameraMovementOptions = getCameraMovementOptions();

  // 加载素材列表
  useEffect(() => {
    if (isAssetSelectorOpen && project?.id) {
      setIsLoadingAssets(true);
      queryAssets({
        projectId: project.id,
        limit: 100,
      })
        .then((result) => {
          setAssets(result.assets);
        })
        .catch((error) => {
          console.error("加载素材失败:", error);
          toast.error("加载素材失败");
        })
        .finally(() => {
          setIsLoadingAssets(false);
        });
    }
  }, [isAssetSelectorOpen, project?.id]);

  // 筛选素材
  const filteredAssets = useMemo(() => {
    if (!searchQuery) return assets;
    return assets.filter((asset) =>
      asset.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [assets, searchQuery]);

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

  // 处理选择素材
  const handleSelectAsset = async (assetId: string) => {
    setIsUpdatingAsset(true);
    try {
      const result = await updateShotAction(shot.id, {
        imageAssetId: assetId,
      });

      if (result.success) {
        toast.success("素材已关联");
        setIsAssetSelectorOpen(false);
        
        // 刷新分镜数据
        const refreshResult = await refreshShot(shot.id);
        if (refreshResult.success && refreshResult.shot) {
          updateShot(refreshResult.shot);
        }
      } else {
        toast.error(result.error || "关联失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("关联失败");
    } finally {
      setIsUpdatingAsset(false);
    }
  };

  // 处理清除素材
  const handleClearAsset = async () => {
    setIsUpdatingAsset(true);
    try {
      const result = await updateShotAction(shot.id, {
        imageAssetId: null,
      });

      if (result.success) {
        toast.success("已清除素材");
        
        // 刷新分镜数据
        const refreshResult = await refreshShot(shot.id);
        if (refreshResult.success && refreshResult.shot) {
          updateShot(refreshResult.shot);
        }
      } else {
        toast.error(result.error || "清除失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("清除失败");
    } finally {
      setIsUpdatingAsset(false);
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
    <>
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6 @container">
          {/* 顶部：分镜预览图 */}
          <div className="flex flex-col @[640px]:flex-row gap-6">
            {/* 大图预览 */}
            <div className="w-full @[640px]:w-80 shrink-0">
            <div className="aspect-video bg-muted rounded-lg overflow-hidden border flex items-center justify-center relative group">
              {shot.imageAsset?.imageUrl ? (
                <>
                  <Image
                    src={shot.imageAsset.imageUrl}
                    alt={`分镜 ${shot.order}`}
                    fill
                    className="object-contain"
                    sizes="320px"
                  />
                  {/* 悬停操作按钮 */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setIsAssetSelectorOpen(true)}
                      disabled={isUpdatingAsset}
                    >
                      <ImagePlus className="w-4 h-4 mr-1.5" />
                      更换素材
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleClearAsset}
                      disabled={isUpdatingAsset}
                    >
                      <X className="w-4 h-4 mr-1.5" />
                      清除
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground p-6">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm mb-3">暂无图片</p>
                  <Button
                    size="sm"
                    onClick={() => setIsAssetSelectorOpen(true)}
                    disabled={isUpdatingAsset}
                  >
                    <ImagePlus className="w-4 h-4 mr-1.5" />
                    选择素材
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

    {/* 素材选择对话框 */}
    <Dialog open={isAssetSelectorOpen} onOpenChange={setIsAssetSelectorOpen}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>选择分镜素材</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 搜索框 */}
          <div className="relative">
            <ImageIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索素材..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* 素材网格 */}
          <ScrollArea className="h-[400px] pr-4">
            {isLoadingAssets ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? "未找到匹配的素材" : "暂无素材"}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {filteredAssets.map((asset) => {
                  const isSelected = shot.imageAssetId === asset.id;
                  return (
                    <button
                      key={asset.id}
                      onClick={() => !isUpdatingAsset && handleSelectAsset(asset.id)}
                      disabled={!asset.imageUrl || isUpdatingAsset}
                      className={`
                        relative group aspect-square rounded-lg overflow-hidden
                        border-2 transition-all
                        ${isSelected
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-transparent hover:border-muted-foreground/20"
                        }
                        ${!asset.imageUrl && "opacity-50 cursor-not-allowed"}
                        ${isUpdatingAsset && "cursor-wait"}
                      `}
                    >
                      {asset.imageUrl ? (
                        <Image
                          src={asset.imageUrl}
                          alt={asset.name}
                          fill
                          className="object-cover"
                          sizes="160px"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* 选中标记 */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                          <ImageIcon className="h-3 w-3" />
                        </div>
                      )}

                      {/* 名称 */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-xs text-white truncate">{asset.name}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

