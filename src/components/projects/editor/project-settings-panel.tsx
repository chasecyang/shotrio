"use client";

import { useEditor } from "./editor-context";
import { ProjectSettingsForm } from "@/components/projects/settings/project-settings-form";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

export function ProjectSettingsPanel() {
  const { state, setShowSettings } = useEditor();
  const { project } = state;
  const t = useTranslations("projects.settings");

  if (!project) return null;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b shrink-0 px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowSettings(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6">
          <ProjectSettingsForm
            project={project}
            userId={project.userId}
          />
        </div>
      </div>
    </div>
  );
}

