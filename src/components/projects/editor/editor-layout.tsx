"use client";

import { useState, useEffect } from "react";
import { useEditor } from "./editor-context";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { BetaBanner } from "@/components/ui/beta-banner";
import { EditorProvider } from "./editor-context";
import { EditorHeader } from "./editor-header";
import { AgentPanel } from "./agent-panel/agent-panel";
import { AssetGalleryPanel } from "./asset-gallery-panel";
import { AssetGenerationDialog } from "./asset-generation-dialog";
import { EditingModeLayout } from "./editing-mode/editing-mode-layout";
import { useEditorKeyboard } from "./use-editor-keyboard";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProjectDetail } from "@/types/project";
import { Monitor, ArrowLeft } from "lucide-react";
import { AgentProvider } from "./agent-panel";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import type { EditorProject, EditorUser } from "./editor-types";

// 移动端提示组件
function MobileNotSupported() {
  const t = useTranslations("editor.mobileNotSupported");
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-6">
      <div className="flex flex-col items-center text-center max-w-sm">
        {/* Logo */}
        <span className="text-2xl font-bold mb-8">
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Shot</span>
          <span className="text-primary/40">Rio</span>
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
  initialView?: string;
}

function EditorLayoutInner({
  project,
  projects,
  user,
  initialView,
}: EditorLayoutProps) {
  const { state } = useEditor();
  
  // 注册键盘快捷键
  useEditorKeyboard();
  
  // 素材生成对话框状态
  const [assetGenerationOpen, setAssetGenerationOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* 顶部工具栏 */}
      <EditorHeader
        projectId={project.id}
        projects={projects}
        user={user}
      />

      {/* Beta Notice - 编辑器专用 */}
      <BetaBanner dismissible storageKey="editor-beta-banner-dismissed" />

      {/* 主内容区：根据模式切换布局 */}
      {state.mode === "editing" ? (
        /* 剪辑模式：保持Agent在左侧，右侧是剪辑界面 */
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* 左侧：AI 对话面板 */}
          <ResizablePanel defaultSize={30} minSize={20} maxSize={60}>
            <div className="h-full overflow-hidden border-r">
              <AgentPanel projectId={project.id} />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* 右侧：剪辑界面 */}
          <ResizablePanel defaultSize={70} minSize={40}>
            <EditingModeLayout />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        /* 素材管理模式：原有布局 */
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* 左侧：AI 对话面板 */}
          <ResizablePanel defaultSize={30} minSize={20} maxSize={60}>
            <div className="h-full overflow-hidden border-r">
              <AgentPanel projectId={project.id} />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* 右侧：素材展示面板 */}
          <ResizablePanel defaultSize={70} minSize={40}>
            <div className="h-full overflow-hidden">
              <AssetGalleryPanel 
                userId={user.id}
                onOpenAssetGeneration={() => setAssetGenerationOpen(true)}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      {/* 素材生成对话框 */}
      <AssetGenerationDialog
        open={assetGenerationOpen}
        onOpenChange={setAssetGenerationOpen}
        projectId={project.id}
      />
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

