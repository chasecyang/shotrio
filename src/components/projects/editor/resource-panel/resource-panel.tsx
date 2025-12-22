"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Images, Bot } from "lucide-react";
import { useEditor } from "../editor-context";
import { EpisodeList } from "./episode-list";
import { AssetPanel } from "./asset-panel";
import { AgentEntry } from "./agent-entry";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";

export function ResourcePanel() {
  const { state } = useEditor();
  const { project } = state;
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();
  
  // 从 URL 参数读取默认标签页
  const defaultTab = searchParams.get("tab") || "episodes";

  if (!project || !session?.user?.id) return null;

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue={defaultTab} className="h-full flex flex-col">
        <div className="px-3 pt-3 shrink-0">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="episodes" className="text-xs gap-1">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">剧本</span>
            </TabsTrigger>
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

        <TabsContent value="episodes" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              <EpisodeList episodes={project.episodes} />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="assets" className="flex-1 mt-0 overflow-hidden">
          <AssetPanel userId={session.user.id} />
        </TabsContent>

        <TabsContent value="agent" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <AgentEntry projectId={project.id} />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

