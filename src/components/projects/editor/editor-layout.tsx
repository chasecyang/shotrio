"use client";

import { ReactNode, useEffect, useState } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { EditorProvider, useEditor } from "./editor-context";
import { EditorHeader } from "./editor-header";
import { TimelineContainer } from "./timeline/timeline-container";
import { useEditorKeyboard } from "./use-editor-keyboard";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProjectDetail } from "@/types/project";
import { createShot, deleteShot } from "@/lib/actions/project";
import { refreshEpisodeShots } from "@/lib/actions/project/refresh";
import { batchGenerateShotVideos } from "@/lib/actions/video/generate";
import { getExportableShots } from "@/lib/actions/video/export";
import { toast } from "sonner";
import { Monitor, ArrowLeft } from "lucide-react";
import { AgentProvider } from "./agent-panel";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import JSZip from "jszip";
import type { EditorProject, EditorUser } from "./editor-types";

// 移动端提示组件
function MobileNotSupported() {
  const t = useTranslations("editor.mobileNotSupported");
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-6">
      <div className="flex flex-col items-center text-center max-w-sm">
        {/* Logo */}
        <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-8">
          Shotrio
        </span>
        
        {/* 图标 */}
        <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
          <Monitor className="w-10 h-10 text-muted-foreground" />
        </div>
        
        {/* 提示文案 */}
        <h1 className="text-xl font-semibold mb-3">
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          {t("description")}
        </p>
        
        {/* 返回按钮 */}
        <Button asChild variant="outline" className="gap-2">
          <Link href="/projects">
            <ArrowLeft className="w-4 h-4" />
            {t("backToProjects")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

interface EditorLayoutProps {
  project: ProjectDetail;
  projects: EditorProject[];
  user: EditorUser;
  resourcePanel: ReactNode;
  previewPanel: ReactNode;
  initialView?: string;
}

function EditorLayoutInner({
  project,
  projects,
  user,
  resourcePanel,
  previewPanel,
  initialView,
}: EditorLayoutProps) {
  const { state, dispatch, jobs } = useEditor();

  // 注册键盘快捷键
  useEditorKeyboard();

  // 处理 URL 参数 - 初始化 settings 视图
  useEffect(() => {
    if (initialView === "settings") {
      dispatch({
        type: "SELECT_RESOURCE",
        payload: { type: "settings", id: project.id },
      });
    }
  }, [initialView, project.id, dispatch]);

  // 批量生成的 loading 状态
  const [isBatchGeneratingVideos, setIsBatchGeneratingVideos] = useState(false);
  const [isExportingVideos, setIsExportingVideos] = useState(false);

  const hasBatchVideoJob = jobs.some(job => 
    job.type === 'batch_video_generation' && 
    (job.status === 'pending' || job.status === 'processing')
  );

  useEffect(() => {
    if (hasBatchVideoJob) {
      setIsBatchGeneratingVideos(false);
    }
  }, [hasBatchVideoJob]);

  // 加载分镜数据
  useEffect(() => {
    async function loadShots() {
      if (!state.selectedEpisodeId) {
        dispatch({ type: "SET_SHOTS", payload: [] });
        return;
      }

      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const result = await refreshEpisodeShots(state.selectedEpisodeId);
        if (result.success && result.shots) {
          dispatch({ type: "SET_SHOTS", payload: result.shots });
        } else {
          toast.error(result.error || "加载分镜失败");
        }
      } catch (error) {
        console.error("加载分镜失败:", error);
        toast.error("加载分镜失败");
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }

    loadShots();
    // dispatch 是稳定的引用，不需要添加到依赖数组
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedEpisodeId]);

  // 添加分镜
  const handleAddShot = async () => {
    if (!state.selectedEpisodeId) return;

    try {
      const newOrder = state.shots.length + 1;
      const result = await createShot({
        episodeId: state.selectedEpisodeId,
        order: newOrder,
        shotSize: "medium_shot",
        duration: 3000,
      });

      if (result.success) {
        toast.success("分镜已添加");
        // 重新加载分镜
        const refreshResult = await refreshEpisodeShots(state.selectedEpisodeId);
        if (refreshResult.success && refreshResult.shots) {
          dispatch({ type: "SET_SHOTS", payload: refreshResult.shots });
        }
      } else {
        toast.error(result.error || "添加失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("添加分镜失败");
    }
  };

  // 删除选中分镜
  const handleDeleteShots = async () => {
    if (state.selectedShotIds.length === 0) return;

    try {
      for (const shotId of state.selectedShotIds) {
        await deleteShot(shotId);
      }
      toast.success(`已删除 ${state.selectedShotIds.length} 个分镜`);
      dispatch({ type: "CLEAR_SHOT_SELECTION" });
      
      // 重新加载分镜
      if (state.selectedEpisodeId) {
        const result = await refreshEpisodeShots(state.selectedEpisodeId);
        if (result.success && result.shots) {
          dispatch({ type: "SET_SHOTS", payload: result.shots });
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("删除分镜失败");
    }
  };

  // 批量生成视频
  const handleGenerateVideos = async () => {
    if (state.selectedShotIds.length === 0) {
      toast.error("请先选择要生成视频的分镜");
      return;
    }

    // 检查选中的分镜是否都有图片
    const shotsWithoutImages = state.shots.filter(
      s => state.selectedShotIds.includes(s.id) && !s.imageAsset?.imageUrl
    );

    if (shotsWithoutImages.length > 0) {
      toast.error(`有 ${shotsWithoutImages.length} 个分镜没有图片，请先生成图片`);
      return;
    }

    setIsBatchGeneratingVideos(true);
    try {
      const result = await batchGenerateShotVideos(state.selectedShotIds);
      if (result.success) {
        toast.success(`已启动 ${state.selectedShotIds.length} 个分镜的视频生成任务`);
        // 不在这里重置状态，等待 Job 被检测到后再重置
      } else {
        toast.error(result.error || "启动失败");
        setIsBatchGeneratingVideos(false); // 失败时才重置
      }
    } catch (error) {
      console.error(error);
      toast.error("启动批量生成失败");
      setIsBatchGeneratingVideos(false); // 出错时才重置
    }
  };

  // 批量导出视频
  const handleExportVideos = async () => {
    if (state.selectedShotIds.length === 0) {
      toast.error("请先选择要导出的分镜");
      return;
    }

    setIsExportingVideos(true);
    const toastId = toast.loading("正在准备导出...");

    try {
      // 1. 获取可导出的分镜数据
      const result = await getExportableShots(state.selectedShotIds);
      
      if (!result.success || !result.shots || result.shots.length === 0) {
        toast.error(result.error || "没有可导出的视频", { id: toastId });
        setIsExportingVideos(false);
        return;
      }

      // 显示跳过信息
      if (result.skippedCount > 0) {
        toast.info(`已跳过 ${result.skippedCount} 个未生成视频的分镜`, { id: toastId });
      }

      // 2. 创建 ZIP
      const zip = new JSZip();
      const totalVideos = result.shots.length;

      // 3. 下载并添加每个视频到 ZIP
      for (let i = 0; i < result.shots.length; i++) {
        const shotData = result.shots[i];
        
        toast.loading(`正在打包视频 (${i + 1}/${totalVideos})...`, { id: toastId });

        try {
          // 下载视频文件
          const response = await fetch(shotData.videoUrl);
          if (!response.ok) {
            throw new Error(`下载失败: ${response.statusText}`);
          }
          
          const blob = await response.blob();
          
          // 生成文件名: shot-001.mp4
          const filename = `shot-${String(shotData.order).padStart(3, '0')}.mp4`;
          
          // 添加到 ZIP
          zip.file(filename, blob);
        } catch (error) {
          console.error(`下载视频失败 (Shot ${shotData.order}):`, error);
          toast.warning(`镜头 ${shotData.order} 下载失败，已跳过`, { id: toastId });
        }
      }

      // 4. 生成 ZIP 并下载
      toast.loading("正在生成压缩包...", { id: toastId });
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: "DEFLATE",
        compressionOptions: {
          level: 6
        }
      });

      // 5. 触发浏览器下载
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      
      // 获取当前剧集信息生成更友好的文件名
      const currentEpisode = state.project?.episodes.find(
        ep => ep.id === state.selectedEpisodeId
      );
      const episodeName = currentEpisode 
        ? `第${currentEpisode.order}集` 
        : 'shots';
      
      a.download = `${episodeName}-分镜视频-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 6. 显示成功消息
      toast.success(`成功导出 ${totalVideos} 个视频`, { id: toastId });
      
    } catch (error) {
      console.error("导出视频失败:", error);
      toast.error(
        error instanceof Error ? error.message : "导出失败，请重试",
        { id: toastId }
      );
    } finally {
      setIsExportingVideos(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* 顶部工具栏 */}
      <EditorHeader
        projectId={project.id}
        projects={projects}
        user={user}
      />

      {/* 主内容区：上下分割 */}
      <ResizablePanelGroup direction="vertical" className="flex-1">
        {/* 上半部分：资源面板 + 预览区 */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* 资源面板 */}
            <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
              <div className="h-full overflow-auto border-r bg-card">
                {resourcePanel}
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* 预览/编辑区 */}
            <ResizablePanel defaultSize={75}>
              <div className="h-full overflow-hidden bg-background">
                {previewPanel}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 下半部分：时间轴轨道 */}
        <ResizablePanel defaultSize={40} minSize={20} maxSize={60}>
          <div className="h-full overflow-hidden bg-card/50 backdrop-blur-sm">
            <TimelineContainer 
              onAddShot={handleAddShot}
              onDeleteShots={handleDeleteShots}
              onGenerateVideos={handleGenerateVideos}
              onExportVideos={handleExportVideos}
              isBatchGeneratingVideos={isBatchGeneratingVideos || hasBatchVideoJob}
              isExportingVideos={isExportingVideos}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export function EditorLayout(props: EditorLayoutProps) {
  const isMobile = useIsMobile();

  // 移动端直接显示提示页面，不初始化 Editor 相关的 Provider
  if (isMobile) {
    return <MobileNotSupported />;
  }

  return (
    <EditorProvider initialProject={props.project}>
      <AgentProvider projectId={props.project.id}>
        <EditorLayoutInner {...props} />
      </AgentProvider>
    </EditorProvider>
  );
}

