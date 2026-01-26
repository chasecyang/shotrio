"use client";

import { CutListItem } from "@/types/cut";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Film, Trash2, MoreHorizontal, Pencil, Clock } from "lucide-react";
import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

interface CutCardProps {
  cut: CutListItem;
  onClick: (cut: CutListItem) => void;
  onDelete?: (cut: CutListItem) => void;
  onRename?: (cut: CutListItem) => void;
}

export function CutCard({ cut, onClick, onDelete, onRename }: CutCardProps) {
  const t = useTranslations("editor.cutCard");
  const [isHovered, setIsHovered] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    }
    return `0:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative rounded-lg border overflow-hidden transition-all cursor-pointer bg-card",
        "hover:border-primary/40 hover:bg-accent/50"
      )}
      onClick={() => onClick(cut)}
    >
      {/* Thumbnail area */}
      <div
        className="relative w-full bg-muted/30 overflow-hidden"
        style={{ paddingBottom: "56.25%" }}
      >
        {cut.thumbnailUrl ? (
          <>
            {isImageLoading && (
              <div className="absolute inset-0 bg-muted animate-pulse" />
            )}
            <Image
              src={cut.thumbnailUrl}
              alt={cut.title}
              fill
              className={cn(
                "object-cover transition-opacity duration-300",
                isImageLoading ? "opacity-0" : "opacity-100"
              )}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 250px"
              quality={90}
              loading="lazy"
              onLoad={() => setIsImageLoading(false)}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Film className="h-6 w-6 text-primary/70" />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Cut
            </span>
          </div>
        )}

        {/* Cut badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-primary/90 text-primary-foreground text-[10px] font-medium">
          Cut
        </div>

        {/* Duration badge */}
        {cut.duration > 0 && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur-sm text-xs font-medium flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(cut.duration)}
          </div>
        )}

        {/* Hover actions */}
        {(isHovered || isDropdownOpen) && (
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-background/90 via-background/60 to-transparent pointer-events-none animate-in fade-in slide-in-from-bottom-1 duration-200">
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center gap-1 pointer-events-auto">
                {/* More actions dropdown */}
                <DropdownMenu onOpenChange={setIsDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 bg-background/20 hover:bg-background/30 text-foreground backdrop-blur-sm transition-all hover:scale-105"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onRename && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onRename(cut);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        {t("rename")}
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(cut);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        {t("delete")}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Delete button - pushed to right */}
                {onDelete && (
                  <div className="ml-auto">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 bg-white/10 hover:bg-destructive/80 text-white/90 hover:text-white backdrop-blur-sm transition-all hover:scale-105"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(cut);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {t("delete")}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>
            </TooltipProvider>
          </div>
        )}
      </div>

      {/* Info area */}
      <div className="p-3 space-y-1">
        <h4 className="text-sm font-medium truncate" title={cut.title}>
          {cut.title}
        </h4>
        <p className="text-xs text-muted-foreground">
          {t("clipCount", { count: cut.clipCount })}
        </p>
      </div>
    </div>
  );
}
