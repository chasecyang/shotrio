"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjectSettingsForm } from "@/components/projects/settings/project-settings-form";
import { useEditor } from "./editor-context";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProjectSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectSettingsDialog({
  open,
  onOpenChange,
}: ProjectSettingsDialogProps) {
  const { state } = useEditor();
  const { project } = state;

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>项目设置</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-5rem)]">
          <div className="px-6 pb-6">
            <ProjectSettingsForm 
              project={project} 
              userId={project.userId} 
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

