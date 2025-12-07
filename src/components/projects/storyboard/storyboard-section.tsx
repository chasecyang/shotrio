"use client";

import { useState } from "react";
import { ProjectDetail, isEpisodeComplete } from "@/types/project";
import { Clapperboard, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { EpisodeSelector } from "./episode-selector";
import { ShotGrid } from "./shot-grid";
import { useTranslations } from "next-intl";

interface StoryboardSectionProps {
  project: ProjectDetail;
}

export function StoryboardSection({ project }: StoryboardSectionProps) {
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(
    project.episodes.length > 0 ? project.episodes[0].id : null
  );
  const t = useTranslations("projects.storyboard");

  const selectedEpisode = project.episodes.find(
    (ep) => ep.id === selectedEpisodeId
  );

  // 空状态：没有剧集
  if (project.episodes.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="border rounded-lg p-8 text-center max-w-md">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Clapperboard className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">
            {t("noEpisodes.title")}
          </h3>
          <p className="text-muted-foreground mb-6">
            {t("noEpisodes.description")}
          </p>
          <Button asChild>
            <Link href={`/projects/${project.id}/scripts`}>
              {t("noEpisodes.action")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // 信息不全状态
  const isIncomplete = selectedEpisode && !isEpisodeComplete(selectedEpisode);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* 顶部：剧集选择器 */}
      <div className="w-full max-w-md">
        <EpisodeSelector
          episodes={project.episodes}
          selectedEpisodeId={selectedEpisodeId}
          onSelectEpisode={setSelectedEpisodeId}
        />
      </div>

      {/* 分镜内容区域 */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {isIncomplete && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-900 dark:text-yellow-400 mb-1">
                {t("incompleteEpisode.title")}
              </h4>
              <p className="text-yellow-700 dark:text-yellow-300/90 mb-2">
                {t("incompleteEpisode.description")}
              </p>
              <Button
                variant="link"
                className="h-auto p-0 text-yellow-800 dark:text-yellow-300 underline"
                asChild
              >
                <Link href={`/projects/${project.id}/scripts`}>
                  {t("incompleteEpisode.action")}
                </Link>
              </Button>
            </div>
          </div>
        )}

        {selectedEpisode && (
          <ShotGrid
            episode={selectedEpisode}
            characters={project.characters}
          />
        )}
      </div>
    </div>
  );
}

