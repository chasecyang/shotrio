"use client";

import { useEditor } from "./editor-context";
import { Images, Film } from "lucide-react";
import { cn } from "@/lib/utils";

export function ModeTabBar() {
  const { state, setMode } = useEditor();
  const { mode } = state;

  return (
    <div className="flex justify-center py-3 border-b bg-background/80 backdrop-blur-sm shrink-0">
      <div className="inline-flex items-center rounded-full bg-muted/60 p-1 gap-0.5">
        <button
          onClick={() => setMode("asset-management")}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all duration-200",
            mode === "asset-management"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          <Images className="h-4 w-4" />
          <span>素材</span>
        </button>
        <button
          onClick={() => setMode("editing")}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all duration-200",
            mode === "editing"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          <Film className="h-4 w-4" />
          <span>剪辑</span>
        </button>
      </div>
    </div>
  );
}
