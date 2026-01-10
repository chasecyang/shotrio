"use client";

import { useEditor } from "./editor-context";
import { Button } from "@/components/ui/button";
import { EditorProvider } from "./editor-context";
import { EditorHeader } from "./editor-header";
import { ModeTabBar } from "./mode-tab-bar";
import { AgentChatContainer } from "./agent-chat-container";
import { AssetGalleryPanel } from "./asset-gallery-panel";
import { ClippingModeLayout } from "./clipping-mode/clipping-mode-layout";
import { ProjectSettingsPanel } from "./project-settings-panel";
import { ActionEditorPanel } from "./action-editor-panel";
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
        <span className="text-2xl font-bold font-heading mb-8">
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

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* 顶部工具栏 */}
      <EditorHeader
        projectId={project.id}
        projects={projects}
        user={user}
      />

      {/* 居中的模式切换Tab */}
      <ModeTabBar />

      {/* 主内容区 - flex 布局容器 */}
      <div className="flex-1 flex relative overflow-hidden p-3 gap-3">
        {/* Agent 对话组件 - 作为 flex 子元素或浮动 */}
        <AgentChatContainer projectId={project.id} />

        {/* 内容面板 - 占满剩余区域，添加卡片包裹 */}
        <div className="flex-1 h-full overflow-hidden bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-lg">
          {state.actionEditor ? (
            <ActionEditorPanel />
          ) : state.showSettings ? (
            <ProjectSettingsPanel />
          ) : state.mode === "clipping" ? (
            <ClippingModeLayout />
          ) : (
            <AssetGalleryPanel />
          )}
        </div>
      </div>
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
