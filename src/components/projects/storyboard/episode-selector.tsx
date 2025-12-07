"use client";

import { Episode, isEpisodeComplete } from "@/types/project";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { getEpisodeShots } from "@/lib/actions/project";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";

interface EpisodeSelectorProps {
  episodes: Episode[];
  selectedEpisodeId: string | null;
  onSelectEpisode: (episodeId: string) => void;
}

export function EpisodeSelector({
  episodes,
  selectedEpisodeId,
  onSelectEpisode,
}: EpisodeSelectorProps) {
  const [shotCounts, setShotCounts] = useState<Record<string, number>>({});
  const t = useTranslations("projects.storyboard");

  // 加载每个剧集的分镜数量
  useEffect(() => {
    const loadShotCounts = async () => {
      const counts: Record<string, number> = {};
      for (const episode of episodes) {
        const shots = await getEpisodeShots(episode.id);
        counts[episode.id] = shots.length;
      }
      setShotCounts(counts);
    };
    loadShotCounts();
  }, [episodes]);

  const selectedEpisode = episodes.find((ep) => ep.id === selectedEpisodeId);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">
        {t("selectEpisode")}
      </label>
      <Select value={selectedEpisodeId || ""} onValueChange={onSelectEpisode}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {selectedEpisode ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {t("episode", { order: selectedEpisode.order })}
                </Badge>
                <span className="truncate">{selectedEpisode.title}</span>
                {!isEpisodeComplete(selectedEpisode) && (
                  <AlertCircle className="w-3.5 h-3.5 text-destructive ml-auto flex-shrink-0" />
                )}
              </div>
            ) : (
              t("pleaseSelectEpisode")
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {episodes.map((episode) => {
            const isComplete = isEpisodeComplete(episode);
            const shotCount = shotCounts[episode.id] || 0;
            const isSelected = episode.id === selectedEpisodeId;

            return (
              <SelectItem
                key={episode.id}
                value={episode.id}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2 w-full pr-6">
                  <Badge
                    variant="outline"
                    className="font-mono text-xs flex-shrink-0"
                  >
                    {t("episode", { order: episode.order })}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">
                        {episode.title}
                      </span>
                      {!isComplete && (
                        <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("shots", { count: shotCount })}
                    </p>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

