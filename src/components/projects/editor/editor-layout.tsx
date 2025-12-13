"use client";

import { ReactNode, useEffect, useState } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EditorProvider, useEditor } from "./editor-context";
import { EditorHeader } from "./editor-header";
import { TimelineContainer } from "./timeline/timeline-container";
import { useEditorKeyboard } from "./use-editor-keyboard";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProjectDetail } from "@/types/project";
import { getEpisodeShots, createShot, deleteShot } from "@/lib/actions/project";
import { toast } from "sonner";
import { FileText, Eye, Film } from "lucide-react";

interface EditorLayoutProps {
  project: ProjectDetail;
  userId: string;
  resourcePanel: ReactNode;
  previewPanel: ReactNode;
}

function EditorLayoutInner({
  project,
  userId,
  resourcePanel,
  previewPanel,
}: EditorLayoutProps) {
  const { state, dispatch } = useEditor();

  // 注册键盘快捷键
  useEditorKeyboard();

  // 加载分镜数据
  useEffect(() => {
    async function loadShots() {
      if (!state.selectedEpisodeId) {
        dispatch({ type: "SET_SHOTS", payload: [] });
        return;
      }

      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const shots = await getEpisodeShots(state.selectedEpisodeId);
        dispatch({ type: "SET_SHOTS", payload: shots });
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
        const shots = await getEpisodeShots(state.selectedEpisodeId);
        dispatch({ type: "SET_SHOTS", payload: shots });
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
        const shots = await getEpisodeShots(state.selectedEpisodeId);
        dispatch({ type: "SET_SHOTS", payload: shots });
      }
    } catch (error) {
      console.error(error);
      toast.error("删除分镜失败");
    }
  };

  // 生成图片
  const handleGenerateImages = async () => {
    toast.info("图片生成功能开发中...");
  };

  // 生成视频
  const handleGenerateVideos = async () => {
    toast.info("视频生成功能开发中...");
  };

  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<string>("timeline");

  // 移动端布局
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        {/* 顶部工具栏（简化版） */}
        <EditorHeader
          projectId={project.id}
          projectTitle={project.title}
          userId={userId}
        />

        {/* 移动端使用 Tabs 切换 */}
        <Tabs value={mobileTab} onValueChange={setMobileTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-2 pt-2 shrink-0 border-b bg-background">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="resources" className="text-xs gap-1">
                <FileText className="h-3.5 w-3.5" />
                资源
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs gap-1">
                <Eye className="h-3.5 w-3.5" />
                预览
              </TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs gap-1">
                <Film className="h-3.5 w-3.5" />
                时间轴
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="resources" className="flex-1 mt-0 overflow-hidden">
            <div className="h-full overflow-auto bg-card">{resourcePanel}</div>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 mt-0 overflow-hidden">
            <div className="h-full overflow-auto bg-background">{previewPanel}</div>
          </TabsContent>

          <TabsContent value="timeline" className="flex-1 mt-0 overflow-hidden">
            <div className="h-full overflow-hidden bg-card/50 backdrop-blur-sm">
              <TimelineContainer 
                onAddShot={handleAddShot}
                onDeleteShots={handleDeleteShots}
                onGenerateImages={handleGenerateImages}
                onGenerateVideos={handleGenerateVideos}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // 桌面端布局
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* 顶部工具栏 */}
      <EditorHeader
        projectId={project.id}
        projectTitle={project.title}
        userId={userId}
      />

      {/* 主内容区：上下分割 */}
      <ResizablePanelGroup direction="vertical" className="flex-1">
        {/* 上半部分：资源面板 + 预览区 */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* 左侧：资源面板 */}
            <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
              <div className="h-full overflow-hidden border-r bg-card">
                {resourcePanel}
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* 右侧：预览/编辑区 */}
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
              onGenerateImages={handleGenerateImages}
              onGenerateVideos={handleGenerateVideos}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export function EditorLayout(props: EditorLayoutProps) {
  return (
    <EditorProvider initialProject={props.project}>
      <EditorLayoutInner {...props} />
    </EditorProvider>
  );
}

