"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Images, Bot } from "lucide-react";
import { useEditor } from "../editor-context";
import { AssetPanel } from "./asset-panel";
import { ConversationList } from "../agent-panel/conversation-list";
import { useAgent } from "../agent-panel/agent-context";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";

export function ResourcePanel() {
  const { state, dispatch, setActiveResourceTab } = useEditor();
  const { project } = state;
  const agent = useAgent();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();
  
  // 从 URL 参数读取默认标签页
  const defaultTab = searchParams.get("tab") || "assets";

  // Tab切换处理
  const handleTabChange = (value: string) => {
    setActiveResourceTab(value as "assets" | "agent");
  };

  // Agent 对话处理函数
  const handleSelectConversation = async (conversationId: string) => {
    if (!project) return;
    await agent.loadConversation(conversationId);
    dispatch({
      type: "SELECT_RESOURCE",
      payload: { type: "agent", id: project.id },
    });
  };

  const handleCreateConversation = async () => {
    if (!project) return;
    await agent.createNewConversation();
    dispatch({
      type: "SELECT_RESOURCE",
      payload: { type: "agent", id: project.id },
    });
  };

  const handleDeleteConversation = async (conversationId: string) => {
    await agent.deleteConversationById(conversationId);
  };

  if (!project || !session?.user?.id) return null;

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue={defaultTab} onValueChange={handleTabChange} className="h-full flex flex-col">
        <div className="px-3 pt-3 shrink-0">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="assets" className="text-xs gap-1">
              <Images className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">素材</span>
            </TabsTrigger>
            <TabsTrigger value="agent" className="text-xs gap-1">
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">AI</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="assets" className="flex-1 mt-0 overflow-hidden">
          <AssetPanel userId={session.user.id} />
        </TabsContent>

        <TabsContent value="agent" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <ConversationList
              currentConversationId={agent.state.currentConversationId}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={handleDeleteConversation}
              onCreateConversation={handleCreateConversation}
              conversations={agent.state.conversations}
              isLoading={agent.state.isLoadingConversations}
              isRefreshing={agent.state.isRefreshingConversations}
            />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

