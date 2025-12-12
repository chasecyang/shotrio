"use client";

import { Episode } from "@/types/project";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEditor } from "../editor-context";
import { FileText, Plus } from "lucide-react";
import { createEpisode, getProjectDetail } from "@/lib/actions/project";
import { toast } from "sonner";
import { useState } from "react";

interface EpisodeListProps {
  episodes: Episode[];
}

export function EpisodeList({ episodes }: EpisodeListProps) {
  const { state, selectEpisode, selectResource, updateProject } = useEditor();
  const { selectedEpisodeId, selectedResource } = state;
  const [isCreating, setIsCreating] = useState(false);

  const handleEpisodeClick = (episode: Episode) => {
    selectEpisode(episode.id);
    selectResource({ type: "episode", id: episode.id });
  };

  const handleCreateEpisode = async () => {
    if (!state.project) return;
    
    setIsCreating(true);
    try {
      const result = await createEpisode({
        projectId: state.project.id,
        title: `第 ${episodes.length + 1} 集`,
        order: episodes.length + 1,
      });

      if (result.success) {
        toast.success("剧集已创建");
        // 重新获取项目数据并更新 context
        const updatedProject = await getProjectDetail(state.project.id);
        if (updatedProject) {
          updateProject(updatedProject);
        }
      } else {
        toast.error(result.error || "创建失败");
      }
    } catch (error) {
      console.error(error);
      toast.error("创建失败");
    } finally {
      setIsCreating(false);
    }
  };

  if (episodes.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <FileText className="w-6 h-6 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground mb-3">暂无剧集</p>
        <Button size="sm" onClick={handleCreateEpisode} disabled={isCreating}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          新建剧集
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {episodes.map((episode) => {
        const isSelected = selectedEpisodeId === episode.id;
        const isEditing = selectedResource?.type === "episode" && selectedResource.id === episode.id;

        return (
          <button
            key={episode.id}
            onClick={() => handleEpisodeClick(episode)}
            className={cn(
              "w-full text-left p-3 rounded-lg border transition-all",
              "hover:border-primary/40 hover:bg-accent/50",
              isSelected && "border-primary bg-primary/5",
              isEditing && "ring-2 ring-primary ring-offset-1"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs font-mono">
                第 {episode.order} 集
              </Badge>
              {isSelected && (
                <Badge variant="secondary" className="text-xs">
                  当前
                </Badge>
              )}
            </div>
            <h4 className="text-sm font-medium truncate">{episode.title}</h4>
            {episode.summary && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {episode.summary}
              </p>
            )}
          </button>
        );
      })}

      <Button
        variant="outline"
        size="sm"
        className="w-full mt-2"
        onClick={handleCreateEpisode}
        disabled={isCreating}
      >
        <Plus className="w-3.5 h-3.5 mr-1" />
        新建剧集
      </Button>
    </div>
  );
}

