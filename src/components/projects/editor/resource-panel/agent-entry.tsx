"use client";

import { useEditor } from "../editor-context";
import { useAgent } from "../agent-panel/agent-context";
import { ConversationList } from "../agent-panel/conversation-list";

interface AgentEntryProps {
  projectId: string;
}

export function AgentEntry({ projectId }: AgentEntryProps) {
  const { dispatch } = useEditor();
  const agent = useAgent();

  const handleSelectConversation = (conversationId: string) => {
    dispatch({
      type: "SELECT_RESOURCE",
      payload: { type: "conversation", id: conversationId },
    });
  };

  const handleCreateConversation = async () => {
    // 新的懒创建模式：只设置UI状态，不创建数据库记录
    await agent.createNewConversation();
    // 切换到对话面板（新对话模式）
    dispatch({
      type: "SELECT_RESOURCE",
      payload: { type: "conversation", id: "new" }, // 使用特殊ID标识新对话
    });
  };

  const handleDeleteConversation = async (conversationId: string) => {
    await agent.deleteConversationById(conversationId);
  };

  return (
    <div className="flex h-full flex-col">
      {/* 对话列表（包含新建按钮） */}
      <ConversationList
        currentConversationId={agent.state.currentConversationId}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onCreateConversation={handleCreateConversation}
        conversations={agent.state.conversations}
        isLoading={agent.state.isLoadingConversations}
        projectId={projectId}
      />
    </div>
  );
}
