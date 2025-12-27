"use client";

import { useEditor } from "../editor-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clapperboard, Clock, Image as ImageIcon, Video, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { formatDuration } from "@/lib/utils/shot-utils";
import { useTranslations } from "next-intl";

export function StoryboardPanel() {
  const { state, selectResource, toggleShotSelection, clearShotSelection } = useEditor();
  const { shots, selectedEpisodeId, selectedShotIds } = state;
  const t = useTranslations("editor.storyboard");

  // 如果没有选中剧集
  if (!selectedEpisodeId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-6">
        <div className="text-center space-y-3">
          <Clapperboard className="w-12 h-12 mx-auto opacity-50" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("selectEpisodeFirst")}</p>
            <p className="text-xs text-muted-foreground/80">
              请先在&ldquo;剧本&rdquo;Tab中选择一个剧集
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 如果剧集没有分镜
  if (shots.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-6">
        <div className="text-center space-y-3">
          <Clapperboard className="w-12 h-12 mx-auto opacity-50" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("noShots")}</p>
            <p className="text-xs text-muted-foreground/80">
              使用时间轴工具栏添加新分镜
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 点击分镜卡片
  const handleShotClick = (shotId: string, e: React.MouseEvent) => {
    // Cmd/Ctrl + Click = 多选
    if (e.metaKey || e.ctrlKey) {
      toggleShotSelection(shotId);
    } else {
      // 普通点击：如果已选中则取消，否则选中
      const isCurrentlySelected = selectedShotIds.length === 1 && selectedShotIds[0] === shotId;
      if (isCurrentlySelected) {
        clearShotSelection();
      } else {
        selectResource({ type: "shot", id: shotId });
      }
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-2">
        <div className="text-xs text-muted-foreground px-1 mb-3">
          共 {shots.length} 个分镜
        </div>

        <div className="grid grid-cols-1 gap-2">
          {shots.map((shot) => {
            const isSelected = selectedShotIds.includes(shot.id);
            const duration = shot.duration || 3000;

            return (
              <div
                key={shot.id}
                className={cn(
                  "rounded-lg border p-3 cursor-pointer transition-all",
                  "hover:bg-accent hover:border-accent-foreground/20",
                  isSelected && "bg-accent border-accent-foreground/20 shadow-sm"
                )}
                onClick={(e) => handleShotClick(shot.id, e)}
              >
                <div className="flex gap-3">
                  {/* 缩略图 */}
                  <div className="relative w-20 h-14 rounded bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
                    {shot.imageAsset?.imageUrl ? (
                      <>
                        <Image
                          src={shot.imageAsset.imageUrl}
                          alt={`分镜 #${shot.order}`}
                          fill
                          className="object-cover"
                        />
                        {/* 视频标识 */}
                        {shot.videoUrl && (
                          <div className="absolute bottom-1 right-1 bg-primary rounded px-1 py-0.5">
                            <Video className="w-2.5 h-2.5 text-primary-foreground" />
                          </div>
                        )}
                      </>
                    ) : (
                      <FileText className="w-6 h-6 text-muted-foreground/30" />
                    )}
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium font-mono">
                        #{shot.order}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{formatDuration(duration)}</span>
                      </div>
                      {/* 内容状态 */}
                      <div className="ml-auto flex items-center gap-1">
                        {shot.videoUrl ? (
                          <Video className="w-3.5 h-3.5 text-primary" />
                        ) : shot.imageAsset?.imageUrl ? (
                          <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-muted-foreground/50" />
                        )}
                      </div>
                    </div>

                    {shot.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {shot.description}
                      </p>
                    )}

                    {shot.shotSize && (
                      <div className="text-xs text-muted-foreground/70">
                        {shot.shotSize}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}

