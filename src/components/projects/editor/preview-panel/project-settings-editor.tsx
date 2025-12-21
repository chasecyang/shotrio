"use client";

import { useEditor } from "../editor-context";
import { ProjectSettingsForm } from "@/components/projects/settings/project-settings-form";
import { Skeleton } from "@/components/ui/skeleton";

export function ProjectSettingsEditor() {
  const { state } = useEditor();

  // project 中已经包含了所有需要的信息
  // userId 可以从 EditorLayout 传递下来
  if (!state.project) {
    return (
      <div className="h-full w-full overflow-auto bg-background">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <ProjectSettingsForm 
          project={state.project} 
          userId={state.project.userId} 
        />
      </div>
    </div>
  );
}

