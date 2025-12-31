"use client";

import { useEditor } from "../editor-context";
import { EpisodeEditor } from "./episode-editor";
import { AssetGenerationEditor } from "./asset-generation-editor";
import { AssetDetailEditor } from "./asset-detail-editor";
import { ProjectSettingsEditor } from "./project-settings-editor";
import { AgentPanel } from "../agent-panel";
import { AgentErrorBoundary } from "../agent-panel/agent-error-boundary";

export function PreviewPanel() {
  const { 
    state, 
    selectedEpisode, 
  } = useEditor();
  const { selectedResource } = state;

  // 渲染 AI Agent 的辅助函数
  const renderAgent = () => {
    if (!state.project?.id) return null;
    return (
      <AgentErrorBoundary>
        <AgentPanel projectId={state.project.id} />
      </AgentErrorBoundary>
    );
  };

  // agent 模式默认显示 AI Agent
  if (!selectedResource || selectedResource.type === "agent") {
    return renderAgent();
  }

  switch (selectedResource.type) {
    case "episode":
      if (selectedEpisode) {
        return <EpisodeEditor episode={selectedEpisode} />;
      }
      break;

    case "asset-generation":
      if (selectedResource.id) {
        return <AssetGenerationEditor projectId={selectedResource.id} />;
      }
      break;

    case "asset":
      if (selectedResource.id) {
        return <AssetDetailEditor assetId={selectedResource.id} />;
      }
      break;

    case "settings":
      return <ProjectSettingsEditor />;
  }

  // Fallback：如果选中了资源但数据加载失败，默认显示 AI Agent
  return renderAgent();
}

