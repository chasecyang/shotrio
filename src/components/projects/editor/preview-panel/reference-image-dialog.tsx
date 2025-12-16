"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Check, Image as ImageIcon } from "lucide-react";
import type { ShotDetail } from "@/types/project";
import { getShotSizeLabel, getCameraMovementLabel } from "@/lib/utils/shot-utils";
import { cn } from "@/lib/utils";

interface ReferenceImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentShotOrder: number;
  availableShots: ShotDetail[];
  onSelectShot: (shotId: string) => void;
}

export function ReferenceImageDialog({
  open,
  onOpenChange,
  currentShotOrder,
  availableShots,
  onSelectShot,
}: ReferenceImageDialogProps) {
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);

  // 只显示当前分镜之前的、有图片的分镜
  const eligibleShots = availableShots.filter(
    (shot) => shot.order < currentShotOrder && shot.imageUrl
  );

  const handleSelect = (shotId: string) => {
    setSelectedShotId(shotId);
  };

  const handleConfirm = () => {
    if (selectedShotId) {
      onSelectShot(selectedShotId);
      onOpenChange(false);
      setSelectedShotId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>复制其他分镜的图片</DialogTitle>
          <DialogDescription>
            从前面的分镜中选择一张图片进行复制。复制后，该图片将应用到当前分镜。
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {eligibleShots.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>前面还没有生成图片的分镜</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eligibleShots.map((shot) => (
                <button
                  key={shot.id}
                  onClick={() => handleSelect(shot.id)}
                  className={cn(
                    "group relative border-2 rounded-lg overflow-hidden transition-all hover:shadow-lg",
                    selectedShotId === shot.id
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {/* 选中指示器 */}
                  {selectedShotId === shot.id && (
                    <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground rounded-full p-1.5">
                      <Check className="w-4 h-4" />
                    </div>
                  )}

                  {/* 分镜图片 */}
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {shot.imageUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={shot.imageUrl}
                          alt={`分镜 ${shot.order}`}
                          className="w-full h-full object-cover"
                        />
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 opacity-30" />
                      </div>
                    )}
                  </div>

                  {/* 分镜信息 */}
                  <div className="p-3 bg-card text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        第 {shot.order} 镜
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {getShotSizeLabel(shot.shotSize)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {getCameraMovementLabel(shot.cameraMovement || "static")}
                      </span>
                    </div>
                    {shot.visualDescription && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {shot.visualDescription}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedShotId(null);
            }}
          >
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedShotId}>
            确认复制
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

