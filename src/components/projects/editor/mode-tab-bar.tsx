"use client";

import { useEditor } from "./editor-context";
import { Images, Film } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ModeTabBar() {
  const { state, setMode } = useEditor();
  const { mode } = state;

  return (
    <div className="flex justify-center py-3 bg-background/80 backdrop-blur-sm shrink-0">
      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as "asset-management" | "editing")}
      >
        <TabsList>
          <TabsTrigger value="asset-management">
            <Images className="h-4 w-4" />
            素材
          </TabsTrigger>
          <TabsTrigger value="editing">
            <Film className="h-4 w-4" />
            剪辑
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
