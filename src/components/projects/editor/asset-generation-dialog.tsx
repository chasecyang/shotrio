"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AssetGenerationEditor } from "./preview-panel/asset-generation-editor";

interface AssetGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function AssetGenerationDialog({
  open,
  onOpenChange,
  projectId,
}: AssetGenerationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] p-0 gap-0">
        <AssetGenerationEditor projectId={projectId} />
      </DialogContent>
    </Dialog>
  );
}

