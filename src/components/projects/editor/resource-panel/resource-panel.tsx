"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Users, Map } from "lucide-react";
import { useEditor } from "../editor-context";
import { EpisodeList } from "./episode-list";
import { CharacterList } from "./character-list";
import { SceneList } from "./scene-list";
import { useSearchParams } from "next/navigation";

export function ResourcePanel() {
  const { state } = useEditor();
  const { project } = state;
  const searchParams = useSearchParams();
  
  // 从 URL 参数读取默认标签页
  const defaultTab = searchParams.get("tab") || "episodes";

  if (!project) return null;

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue={defaultTab} className="h-full flex flex-col">
        <div className="px-3 pt-3 shrink-0">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="episodes" className="text-xs gap-1">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">剧本</span>
            </TabsTrigger>
            <TabsTrigger value="characters" className="text-xs gap-1">
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">角色</span>
            </TabsTrigger>
            <TabsTrigger value="scenes" className="text-xs gap-1">
              <Map className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">场景</span>
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

        <TabsContent value="characters" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              <CharacterList characters={project.characters} projectId={project.id} />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="scenes" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              <SceneList scenes={project.scenes || []} projectId={project.id} />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

